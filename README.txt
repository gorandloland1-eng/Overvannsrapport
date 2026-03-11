=== BACKEND ===
## Installing backend: ##
python3 -m venv venv

## Go into venv ##
source venv/bin/activate

## Accessing imports: ##
pip install -r requirements.txt

## STARTING THE BACKEND!!!!!!!!!!!! ##
uvicorn app.main:app --reload

## Go out of venv: ##
deactivate

## TEST BACKEND ENDPOINTS ##
http://127.0.0.1:8000/docs#/
