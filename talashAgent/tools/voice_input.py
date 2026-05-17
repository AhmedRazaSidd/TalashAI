import speech_recognition as sr
import logging

logger = logging.getLogger(__name__)

def get_voice_input():
    r = sr.Recognizer()
    try:
        with sr.Microphone() as source:
            logger.info("Adjusting for ambient noise. Please wait...")
            r.adjust_for_ambient_noise(source, duration=1)
            logger.info("Listening for voice input...")
            audio = r.listen(source, timeout=10, phrase_time_limit=30)
            
        logger.info("Processing speech...")
        # Use ur-PK language code as required
        text = r.recognize_google(audio, language="ur-PK")
        return text
    except sr.WaitTimeoutError:
        logger.warning("Listening timed out.")
    except sr.UnknownValueError:
        logger.warning("Could not understand audio.")
    except sr.RequestError as e:
        logger.error(f"Could not request results from Google Speech Recognition service; {e}")
    except Exception as e:
        logger.error(f"Voice input error: {e}")
    return None
