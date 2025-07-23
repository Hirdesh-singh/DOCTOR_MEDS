from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import numpy as np
from fastapi.middleware.cors import CORSMiddleware

# Load the trained model and label encoder
model = joblib.load("disease_prediction_model_pipeline.joblib")
label_encoder = joblib.load("label_encoder.joblib")

# Load the full list of symptoms from the training dataset (use the column names)
all_symptoms = [
    "itching", "skin_rash", "nodal_skin_eruptions", "continuous_sneezing", "shivering", "chills", "joint_pain", 
    "stomach_pain", "acidity", "ulcers_on_tongue", "muscle_wasting", "vomiting", "burning_micturition", 
    "spotting_ urination", "fatigue", "weight_gain", "anxiety", "cold_hands_and_feets", "mood_swings", 
    "weight_loss", "restlessness", "lethargy", "patches_in_throat", "irregular_sugar_level", "cough", 
    "high_fever", "sunken_eyes", "breathlessness", "sweating", "dehydration", "indigestion", "headache", 
    "yellowish_skin", "dark_urine", "nausea", "loss_of_appetite", "pain_behind_the_eyes", "back_pain", 
    "constipation", "abdominal_pain", "diarrhoea", "mild_fever", "yellow_urine", "yellowing_of_eyes", 
    "acute_liver_failure", "fluid_overload", "swelling_of_stomach", "swelled_lymph_nodes", "malaise", 
    "blurred_and_distorted_vision", "phlegm", "throat_irritation", "redness_of_eyes", "sinus_pressure", 
    "runny_nose", "congestion", "chest_pain", "weakness_in_limbs", "fast_heart_rate", "pain_during_bowel_movements", 
    "pain_in_anal_region", "bloody_stool", "irritation_in_anus", "neck_pain", "dizziness", "cramps", "bruising", 
    "obesity", "swollen_legs", "swollen_blood_vessels", "puffy_face_and_eyes", "enlarged_thyroid", "brittle_nails", 
    "swollen_extremeties", "excessive_hunger", "extra_marital_contacts", "drying_and_tingling_lips", 
    "slurred_speech", "knee_pain", "hip_joint_pain", "muscle_weakness", "stiff_neck", "swelling_joints", 
    "movement_stiffness", "spinning_movements", "loss_of_balance", "unsteadiness", "weakness_of_one_body_side", 
    "loss_of_smell", "bladder_discomfort", "foul_smell_of urine", "continuous_feel_of_urine", "passage_of_gases", 
    "internal_itching", "toxic_look_(typhos)", "depression", "irritability", "muscle_pain", "altered_sensorium", 
    "red_spots_over_body", "belly_pain", "abnormal_menstruation", "dischromic _patches", "watering_from_eyes", 
    "increased_appetite", "polyuria", "family_history", "mucoid_sputum", "rusty_sputum", "lack_of_concentration", 
    "visual_disturbances", "receiving_blood_transfusion", "receiving_unsterile_injections", "coma", 
    "stomach_bleeding", "distention_of_abdomen", "history_of_alcohol_consumption", "fluid_overload", 
    "blood_in_sputum", "prominent_veins_on_calf", "palpitations", "painful_walking", "pus_filled_pimples", 
    "blackheads", "scurring", "skin_peeling", "silver_like_dusting", "small_dents_in_nails", "inflammatory_nails", 
    "blister", "red_sore_around_nose", "yellow_crust_ooze"
]

# Define input data schema
class PredictionInput(BaseModel):
    symptoms: list[str]

app = FastAPI(title="Disease Prediction API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Replace "*" with specific origins for production, e.g., ["http://127.0.0.1:5500"]
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

@app.post("/predict")
def predict(input_data: PredictionInput):
    try:
        # Create a binary vector for all symptoms
        input_vector = [1 if symptom in input_data.symptoms else 0 for symptom in all_symptoms]
        
        # Convert to numpy array and reshape
        input_vector = np.array(input_vector).reshape(1, -1)
        
        # Predict using the model
        prediction = model.predict(input_vector)
        disease = label_encoder.inverse_transform(prediction)[0]  # Decode the predicted label
        
        return {"predicted_disease": disease}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
