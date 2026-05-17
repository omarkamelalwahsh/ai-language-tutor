import os
import requests

url = "https://lh3.googleusercontent.com/aida/ADBb0uiwcQvb4SGk0-xBobCD14mB3btFHVR-7ABxm4-8V5u5QCVMq2WQkWQXjEIPr5fnY1o4YbaoVJBkfoqMvpNhLhA8wHzuufTpyvH0vKIMrGmRbjrg9BqfmgNnYk1mQdNsgQIuR_QlxtgiDwSr9xmnKcqGFWw-pjwr5uNKUbZKIFwHMeGAOOKP5Ba2ZQ-BlB5WAKwTQ7NY0fDC559YkDfA6NYHAZvcYIBtALPPrVe6RgmbIVItwN8R0Tvy-NE"
output_path = "C:/Users/User/.gemini/antigravity/brain/821e6b16-3c94-4a82-bd7a-f44f997447f3/mobile_design_downloaded.png"

def download():
    response = requests.get(url, stream=True)
    if response.status_code == 200:
        with open(output_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Successfully downloaded image to {output_path}")
    else:
        print(f"Failed to download image: {response.status_code}")

if __name__ == "__main__":
    download()
