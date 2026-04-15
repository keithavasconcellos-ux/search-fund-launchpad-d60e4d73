import os
import sys
import uuid
import pandas as pd
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

URLS = [
    "https://data.sba.gov/dataset/0ff8e8e9-b967-4f4e-987c-6ac78c575087/resource/3f838176-6060-44db-9c91-b4acafbcb28c/download/foia-7a-fy2010-fy2019-asof-250930.csv",
    "https://data.sba.gov/dataset/0ff8e8e9-b967-4f4e-987c-6ac78c575087/resource/d67d3ccb-2002-4134-a288-481b51cd3479/download/foia-7a-fy2020-present-as-of-251231.csv"
]

rows_inserted = 0

def generate_id(row):
    unique_string = f"{row.get('program','')}_{row.get('borrname','')}_{row.get('approvaldate','')}_{row.get('grossapproval','')}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, unique_string))

for url in URLS:
    print(f"Downloading and processing: {url}")
    # Read in chunks to manage memory
    for chunk in pd.read_csv(url, chunksize=10000, low_memory=False, dtype=str):
        # Filter strictly for target states
        target_states = ['MA', 'NH', 'CT', 'RI', 'ME', 'VT']
        ma_chunk = chunk[chunk['borrstate'].str.upper().isin(target_states)].copy()
        
        if ma_chunk.empty:
            continue
            
        records = []
        for _, row in ma_chunk.iterrows():
            record = {
                'id': generate_id(row),
                'program': row.get('program', None),
                'borr_name': row.get('borrname', None),
                'borr_city': row.get('borrcity', None),
                'borr_state': row.get('borrstate', None),
                'borr_zip': row.get('borrzip', None),
                'naics_code': row.get('naicscode', None),
                'loan_status': row.get('loanstatus', None)
            }
            
            # format gross approval safely
            try:
                val = str(row.get('grossapproval', '')).replace('$', '').replace(',', '').strip()
                record['gross_approval'] = float(val) if val else None
            except:
                record['gross_approval'] = None
                
            try:
                dt = pd.to_datetime(row.get('approvaldate'))
                if not pd.isna(dt):
                    record['approval_date'] = dt.strftime('%Y-%m-%d')
            except:
                pass
                
            # Convert any NaNs to None for supabase
            for k, v in record.items():
                if pd.isna(v):
                    record[k] = None
                    
            records.append(record)
            
        if records:
            # deduplicate by id to prevent postgres upsert error inside single chunk
            seen = set()
            dedup_records = []
            for r in records:
                if r['id'] not in seen:
                    seen.add(r['id'])
                    dedup_records.append(r)
            try:
                response = supabase.table('sba_loans').upsert(dedup_records).execute()
                rows_inserted += len(response.data)
                print(f"Inserted {len(response.data)} records (Total inserted: {rows_inserted})")
            except Exception as e:
                print(f"Error inserting chunk: {e}")

print(f"Import complete! Total rows processed and inserted/upserted: {rows_inserted}")
