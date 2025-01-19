import os
import sys
import h5py
import json
from datetime import datetime, timedelta

# ضبط الترميز الافتراضي
sys.stdout.reconfigure(encoding='utf-8')

def find_h5_file(data_dir="../data"):  
    for file_name in os.listdir(data_dir):
        if file_name.endswith(".h5"):
            return os.path.join(data_dir, file_name)
    raise FileNotFoundError("No .h5 file found in the data directory")

# تحديد مسار ملف H5
h5_file_path = sys.argv[1] if len(sys.argv) > 1 else find_h5_file()

# تحديد المسار الأساسي للمشروع
base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# مسار الإخراج النسبي
output_json_path = os.path.join(base_dir, "output", "fhir_observations.json")

print(f"Processing file: {h5_file_path}")
print(f"Output file will be saved to: {output_json_path}")

def process_h5_to_fhir(h5_file_path, output_json_path):
    try:
        with h5py.File(h5_file_path, "r") as h5_file:
            if "98:D3:21:FC:8B:12/raw" in h5_file:
                raw_group = h5_file["98:D3:21:FC:8B:12/raw"]
                ecg_data = raw_group["channel_2"][:].flatten()
                sequence_numbers = raw_group["nSeq"][:].flatten()
            elif "98:D3:21:FC:8B:12/support" in h5_file:
                support_group = h5_file["98:D3:21:FC:8B:12/support/level_10/channel_2"]
                ecg_data = support_group["mean"][:].flatten()
                sequence_numbers = support_group["t"][:].flatten()
            else:
                raise KeyError("No suitable dataset found in the HDF5 file.")
    except Exception as e:
        print(f"Error reading HDF5 file: {e}")
        return

    sampling_rate = 100  
    time_step = 1 / sampling_rate
    start_time = datetime(2024, 12, 23)
    timestamps = [start_time + timedelta(seconds=seq * time_step) for seq in sequence_numbers]

    fhir_observations = [
        {
            "resourceType": "Observation",
            "id": str(int(seq_num)),
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
            "effectiveDateTime": timestamp.isoformat(),
            "valueQuantity": {
                "value": float(ecg_data[i]),
                "unit": "mV",
                "system": "http://unitsofmeasure.org",
                "code": "mV"
            }
        }
        for i, (seq_num, timestamp) in enumerate(zip(sequence_numbers, timestamps))
    ]

    try:
        os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
        with open(output_json_path, "w", encoding="utf-8") as json_file:
            json.dump(fhir_observations, json_file, indent=4, ensure_ascii=False)
        print(f"FHIR observations saved to {output_json_path}")
    except Exception as e:
        print(f"Error saving JSON file: {e}")

process_h5_to_fhir(h5_file_path, output_json_path)
