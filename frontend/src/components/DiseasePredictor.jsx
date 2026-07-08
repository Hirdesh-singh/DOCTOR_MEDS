import React, { useState } from "react";
import axios from "axios";
// import './DiseasePredictor.css';

// Sample list of symptoms
const symptomsList = [
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
    "blister", "red_sore_around_nose", "yellow_crust_ooze",
  // Add more symptoms as needed...
];

const DiseasePredictor = () => {
  const [symptoms, setSymptoms] = useState([{ symptom: "" }]);
  const [prediction, setPrediction] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredSymptoms, setFilteredSymptoms] = useState([]);

  const handleInputChange = (index, event) => {
    const values = [...symptoms];
    values[index].symptom = event.target.value;
    setSymptoms(values);
  };

  const handleAddSymptom = () => {
    setSymptoms([...symptoms, { symptom: "" }]);
  };

  const handleRemoveSymptom = (index) => {
    const values = [...symptoms];
    values.splice(index, 1);
    setSymptoms(values);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    const symptomData = symptoms.map((s) => s.symptom).filter((s) => s.trim() !== "");
    if (symptomData.length === 0) {
      setLoading(false);
      setPrediction("Please enter at least one symptom.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:8000/predict", { symptoms: symptomData });
      setPrediction(response.data.predicted_disease || "No prediction available");
    } catch (error) {
      console.error("Error fetching prediction:", error);
      setPrediction("Error fetching prediction");
    } finally {
      setLoading(false);
    }
  };

  
    // Handle search input change
    const handleSearchChange = (event) => {
      const query = event.target.value;
      setSearchQuery(query);

      // Filter symptoms based on the search query
      const filtered = symptomsList.filter(symptom =>
          symptom.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredSymptoms(filtered);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "auto" }}>
      <h1>Disease Prediction</h1>
      <form onSubmit={handleSubmit}>

        {/* Search Box for Symptoms */}
        <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search for symptoms..."
                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '10px' }}
                />
                {filteredSymptoms.length > 0 && (
                    <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
                        {filteredSymptoms.map((symptom, index) => (
                            <li key={index} style={{ padding: '5px 0', cursor: 'pointer' }} onClick={() => handleAddSymptom(symptom)}>
                                {symptom}
                            </li>
                        ))}
                    </ul>
                )}



        {symptoms.map((input, index) => (
          <div key={index} style={{ marginBottom: "10px" }}>
            <input
              type="text"
              value={input.symptom}
              onChange={(event) => handleInputChange(index, event)}
              placeholder={`Symptom ${index + 1}`}
              style={{
                padding: "8px",
                width: "80%",
                marginRight: "10px",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
            />
            {index > 0 && (
              <button
                type="button"
                onClick={() => handleRemoveSymptom(index)}
                style={{
                  backgroundColor: "#ff4d4d",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  padding: "8px",
                }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={handleAddSymptom}
          style={{
            marginBottom: "20px",
            backgroundColor: "#4CAF50",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "10px",
            cursor: "pointer",
          }}
        >
          Add Symptom
        </button>
        <br />
        <button
          type="submit"
          style={{
            backgroundColor: "#007BFF",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "10px 20px",
            cursor: "pointer",
          }}
        >
          {loading ? "Predicting..." : "Get Prediction"}
        </button>
      </form>
      {prediction && (
        <div style={{ marginTop: "20px", fontSize: "18px" }}>
          <strong>Prediction:</strong> {prediction}
        </div>
      )}
    </div>
  );
};

export default DiseasePredictor;
