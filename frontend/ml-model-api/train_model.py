import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
import joblib

# Load the training and testing data
train_data = pd.read_csv('Training.csv')
test_data = pd.read_csv('Testing.csv')

# Display the first few rows of each dataset
print("Training Data:")
print(train_data.head())

print("\nTesting Data:")
print(test_data.head())

# Separate the target variable (prognosis) from the features
X_train = train_data.drop(columns=['prognosis', 'Unnamed: 133'])  # Drop target column and any unnecessary columns
y_train = train_data['prognosis']

X_test = test_data.drop(columns=['prognosis'])  # Drop target column
y_test = test_data['prognosis']

# Encode the target variable (prognosis) as it is categorical
label_encoder = LabelEncoder()
y_train = label_encoder.fit_transform(y_train)
y_test = label_encoder.transform(y_test)

# Create a column transformer to encode categorical features in X_train and X_test
# Identify columns that need encoding. Here, we assume all columns except the target are categorical.
# You can modify the list of categorical columns as needed.
categorical_columns = X_train.select_dtypes(include=['object']).columns

# We will use OneHotEncoder for categorical features (it works well for nominal data)
preprocessor = ColumnTransformer(
    transformers=[
        ('cat', OneHotEncoder(), categorical_columns)
    ], remainder='passthrough'  # Keep the non-categorical columns as they are
)

# Create a pipeline that first processes the features and then fits the RandomForest model
pipeline = Pipeline(steps=[
    ('preprocessor', preprocessor),
    ('classifier', RandomForestClassifier())
])

# Train the model
pipeline.fit(X_train, y_train)

# Save the trained model and label encoder
joblib.dump(pipeline, 'disease_prediction_model_pipeline.joblib')
joblib.dump(label_encoder, 'label_encoder.joblib')
print("Model and label encoder saved.")
