import os
import sys
import csv
from rapidfuzz import process, fuzz
from dotenv import load_dotenv
from supabase import create_client, Client

env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env.local')
load_dotenv(env_path)

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Supabase credentials not found in .env.local")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_bucket(amount):
    if not amount:
        return "Unknown"
    if amount < 100000:
        return "< $100k"
    elif amount < 500000:
        return "$100k - $500k"
    elif amount < 1000000:
        return "$500k - $1M"
    else:
        return "$1M+"
        
def parse_zip(address):
    if not address:
        return ""
    # simple extraction of last word or standard regex could be used
    parts = address.replace(',', ' ').split()
    for p in reversed(parts):
        if p.isdigit() and len(p) >= 5:
            return p[:5]
    return ""

def run():
    print("Fetching unmatched SBA loans...")
    unmatched_loans = []
    has_more = True
    page = 0
    size = 1000
    while has_more:
        resp = supabase.table('sba_loans').select('*').or_('matched_business_id.is.null,match_method.eq.unmatched').range(page*size, (page+1)*size - 1).execute()
        if not resp.data:
            has_more = False
        else:
            unmatched_loans.extend(resp.data)
            page += 1

    if not unmatched_loans:
        print("No unmatched SBA loans found.")
        return
        
    print(f"Found {len(unmatched_loans)} SBA records to match.")
    
    print("Fetching candidates from businesses...")
    businesses_data = []
    has_more = True
    page = 0
    while has_more:
        resp = supabase.table('businesses').select('id, name, address').range(page*size, (page+1)*size - 1).execute()
        if not resp.data:
            has_more = False
        else:
            businesses_data.extend(resp.data)
            page += 1
            
    # Process zip and city for businesses
    for b in businesses_data:
        addr = str(b.get('address') or '').upper()
        b['derived_zip'] = parse_zip(b.get('address'))
        b['upper_address'] = addr
        b['upper_name'] = str(b.get('name') or '').upper()

    print(f"Loaded {len(businesses_data)} total businesses.")

    review_rows = []
    auto_matched = 0
    needs_review = 0
    unmatched_count = 0
    
    sba_updates = []
    biz_updates = []

    count = 0
    for loan in unmatched_loans:
        count += 1
        if count % 100 == 0:
            print(f"Processed {count} / {len(unmatched_loans)}")
            
        sba_city = str(loan.get('borr_city') or '').upper()
        sba_zip = str(loan.get('borr_zip') or '')[:5]
        sba_name = str(loan.get('borr_name') or '').upper()
        
        # Stage 1: Filter candidates by City or Zip
        candidates = []
        for b in businesses_data:
            match = False
            if sba_zip and sba_zip == b['derived_zip']:
                match = True
            elif sba_city and sba_city in b['upper_address']:
                match = True
            if match:
                candidates.append(b)
                
        if not candidates:
            sba_updates.append({"id": loan['id'], "match_method": "unmatched"})
            unmatched_count += 1
            continue
            
        # Stage 2: Fuzzy Name match
        candidate_names = {b['id']: b['upper_name'] for b in candidates}
        # extractOne returns (match_string, score, match_key)
        best_match = process.extractOne(sba_name, candidate_names, scorer=fuzz.token_sort_ratio)
        
        if not best_match:
            sba_updates.append({"id": loan['id'], "match_method": "unmatched"})
            unmatched_count += 1
            continue
            
        matched_biz_name, score, matched_biz_id = best_match
        
        biz_match_obj = next((b for b in candidates if b['id'] == matched_biz_id), None)
        biz_address = biz_match_obj['address'] if biz_match_obj else ""
        
        if score >= 85:
            auto_matched += 1
            match_method = "auto"
        elif score >= 70:
            needs_review += 1
            match_method = "needs_review"
            review_rows.append({
                "sba_borrower_name": loan.get('borr_name'),
                "sba_city": loan.get('borr_city'),
                "sba_zip": loan.get('borr_zip'),
                "candidate_business_name": matched_biz_name,
                "candidate_city": biz_address, # address contains city
                "match_score": round(score, 2),
                "sba_loan_id": loan['id'],
                "business_id": matched_biz_id
            })
            continue # Don't record needs_review matches to sba_loans yet! wait, the prompt says...
        else:
            sba_updates.append({"id": loan['id'], "match_method": "unmatched"})
            unmatched_count += 1
            continue
            
        # Record updates for auto matches ONLY per instructions...
        # Wait, user said: "When a match is found, write the business UUID to sba_loans.matched_business_id, the score to match_confidence, and one of 'auto', 'needs_review', or 'unmatched' to match_method."
        # Ah, they want needs_review to ALSO write match_method = 'needs_review'!
        
        # BUT wait: "Also write a summary back to the businesses table for any matched business..."
        # Should we write the summary for needs_review? Usually only for auto. The prompt doesn't specify strictly, but it says "for any matched business". I'll only do it for auto. Wait, I should write the `match_method` to the sba_loans table in ALL cases.

        if match_method == "auto":
            sba_updates.append({
                "id": loan['id'],
                "matched_business_id": matched_biz_id,
                "match_confidence": round(score, 2),
                "match_method": match_method
            })
            
            # Map year
            year = None
            try:
                year = int(loan['approval_date'][:4])
            except:
                pass
                
            biz_updates.append({
                "id": matched_biz_id,
                "sba_loan_approved": True,
                "sba_loan_year": year,
                "sba_loan_amount_bucket": get_bucket(loan.get('gross_approval'))
            })

    # Needs Review - update sba_loans match_method so we don't process them endlessly!
    for review in review_rows:
        sba_updates.append({
            "id": review['sba_loan_id'],
            "match_method": "needs_review",
            "matched_business_id": review['business_id'], # user can clear this if rejected or promote to auto later
            "match_confidence": review['match_score']
        })

    # Saving review rows to CSV
    if review_rows:
        csv_path = os.path.join(os.path.dirname(__file__), '..', '..', 'sba_match_review.csv')
        with open(csv_path, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=review_rows[0].keys())
            writer.writeheader()
            writer.writerows(review_rows)

    print("Submitting updates to Supabase...")
    # chunk inserts
    def chunked_upsert(table, data, chunk_size=100):
        for i in range(0, len(data), chunk_size):
            chunk = data[i:i + chunk_size]
            try:
                supabase.table(table).upsert(chunk).execute()
            except Exception as e:
                print(f"Error upserting to {table}: {e}")

    if sba_updates:
        chunked_upsert('sba_loans', sba_updates)
    if biz_updates:
        chunked_upsert('businesses', biz_updates)

    print("-" * 30)
    print("Match Summary:")
    print(f"Total SBA loans processed: {len(unmatched_loans)}")
    print(f"Auto-matched (>= 85): {auto_matched}")
    print(f"Needs Review (70-84): {needs_review}")
    print(f"Unmatched (< 70): {unmatched_count}")
    if review_rows:
        print("Wrote needs_review cases to sba_match_review.csv")

if __name__ == '__main__':
    run()
