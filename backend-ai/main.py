from fastapi import FastAPI, Query
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import joblib
import os

app = FastAPI()

model_path = 'quadrant_model.pkl'

def create_and_train_model():
    # Mock training data - Polish and English titles
    training_data = [
        # Do Now (urgent + important)
        ("urgent deadline tomorrow", 0),
        ("critical issue fix now", 0),
        ("pilny termin jutro", 0),
        ("krytyczny błąd do naprawienia zaraz", 0),
        ("emergency meeting", 0),

        # Schedule (urgent, not important)
        ("schedule call later", 1),
        ("check emails tomorrow", 1),
        ("zobacz maile jutro", 1),
        ("zaplanuj spotkanie", 1),
        ("review documents", 1),

        # Delegate (important, not urgent)
        ("prepare report", 2),
        ("strategize project", 2),
        ("przygotuj raport", 2),
        ("rozważ strategię projektu", 2),
        ("plan future goals", 2),

        # Delete (not important, not urgent)
        ("delete old files", 3),
        ("clean up cache", 3),
        ("usuń stare pliki", 3),
        ("wyczyść pamięć", 3),
        ("ignore spam", 3),
    ]

    texts, labels = zip(*training_data)

    # Create pipeline: TF-IDF + Logistic Regression
    model = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=500, stop_words='english', ngram_range=(1,2))),
        ('clf', LogisticRegression(random_state=42, max_iter=1000))
    ])

    model.fit(texts, labels)
    joblib.dump(model, model_path)
    return model

# Load or create model
if os.path.exists(model_path):
    model = joblib.load(model_path)
    print("Model loaded from file.")
else:
    model = create_and_train_model()
    print("Model trained and saved.")

# Map predictions to boolean
def map_to_bool(prediction):
    # 0: urgent+important, 1: urgent, 2: important, 3: none
    urgent = prediction in [0, 1]
    important = prediction in [0, 2]
    return urgent, important

@app.get("/classify")
def classify_text(title: str = Query(..., description="Task title to classify")):
    prediction = model.predict([title])[0]
    urgent, important = map_to_bool(prediction)
    return {"urgent": urgent, "important": important, "quadrant": int(prediction)}

@app.get("/")
def root():
    return {"message": "AI Quadrant Classifier API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
