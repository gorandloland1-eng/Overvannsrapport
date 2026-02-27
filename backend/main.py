from fastapi import FastAPI

print ("hello world")

app = FastAPI()

@app.get("/")
def root():
    return {"Hello!!"}