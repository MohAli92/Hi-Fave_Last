import os
import json
import numpy as np
from datetime import datetime, timedelta

def find_txt_file(data_dir="data"):
    """Find the first .txt file in the specified directory."""
    for file_name in os.listdir(data_dir):
        if file_name.endswith(".txt"):
            return os.path.join(data_dir, file_name)
    raise FileNotFoundError("No .txt file found in the data directory")

# Paths
txt_file_path = find_txt_file("data") 
output_json_path = os.path.join("output", "fhir_observations.json")

def process_txt_to_fhir_with_metadata(txt_file_path, output_json_path):
    """Process the OpenSignals text file and create a JSON file with detailed observations."""
    with open(txt_file_path, "r") as file:
        lines = file.readlines()
        
        
        for line in lines:
            if line.startswith("#"):
                if line.startswith("# {"):
                    metadata = json.loads(line[2:])
                continue
            break
        
        # Sampling rate and start time from metadata
        sampling_rate = metadata["98:D3:21:FC:8B:12"]["sampling rate"]
        start_date = metadata["98:D3:21:FC:8B:12"]["date"]
        start_time = metadata["98:D3:21:FC:8B:12"]["time"]
        start_datetime = datetime.strptime(f"{start_date} {start_time}", "%Y-%m-%d %H:%M:%S.%f")
        
        # Extract ECG data from column A2 (corresponds to the ECG channel in the file)
        ecg_data = []
        for line in lines:
            if not line.startswith("#"):
                values = line.strip().split('\t')
                ecg_data.append(float(values[6]))  # Column 7 (index 6) is A2 (ECG data)
        
    # Time step calculation
    time_step = 1 / sampling_rate

    # Create FHIR-compliant Observation resources
    fhir_observations = []
    for i, value in enumerate(ecg_data):
        effective_time = start_datetime + timedelta(seconds=i * time_step)
        fhir_observations.append({
            "resourceType": "Observation",
            "id": str(i),
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://hl7.org/fhir/observation-category",
                            "code": "vital-signs"
                        }
                    ]
                }
            ],
            "code": {
                "coding": [
                    {
                        "system": "http://loinc.org",
                        "code": "85354-9",
                        "display": "ECG"
                    }
                ]
            },
            "subject": {"reference": "Patient/1"},
            "effectiveDateTime": effective_time.isoformat(),
            "valueQuantity": {
                "value": float(value),
                "unit": "mV",
                "system": "http://unitsofmeasure.org",
                "code": "mV"
            },
            "samplingRate": sampling_rate
        })

    # Save the observations as a JSON file
    os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
    with open(output_json_path, "w") as json_file:
        json.dump(fhir_observations, json_file, indent=4)

    print(f"FHIR observations with metadata saved to {output_json_path}")

# Run the processing function
process_txt_to_fhir_with_metadata(txt_file_path, output_json_path)
