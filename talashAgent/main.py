import asyncio
import sys
import json
from tools.voice_input import get_voice_input
from pipeline import run_pipeline_stream

GOODBYE = {
    "English": "Exiting INSAAF OS. Goodbye!",
    "Roman Urdu": "INSAAF OS se exit kar rahe hain. Allah Hafiz!",
    "Urdu": "انصاف OS سے باہر نکل رہے ہیں۔ اللہ حافظ!"
}

async def cli_answer_callback(questions):
    answers = []
    print("\n" + "="*50)
    for q in questions:
        print(f"❓ {q.get('question')}")
        ans = await asyncio.to_thread(input, ">> ")
        answers.append({"question_id": q.get('id'), "answer": ans})
    print("="*50 + "\n")
    return answers

async def main():
    print("╔══════════════════════════════════════╗")
    print("║   INSAAF OS 🇵🇰                       ║")
    print("║   Pakistan's AI Legal Assistant      ║")
    print("║   Your Rights — Our Responsibility   ║")
    print("╚══════════════════════════════════════╝\n")
    
    choice = input("Choose input method / Input ka tareeqa chunein:\n [T] Text / Likhein\n [V] Voice / Bolein\n >> ").strip().lower()
    
    user_text = ""
    input_type = "text"
    if choice == 'v':
        user_text = await asyncio.to_thread(get_voice_input)
        input_type = "voice_transcript"
        if not user_text:
            print("Voice input failed / Voice input nakam. Fallback to text.")
            user_text = input("Describe your issue / Apna masla likhein / اپنا مسئلہ لکھیں:\n >> ")
            input_type = "text"
    else:
        user_text = input("Describe your issue / Apna masla likhein / اپنا مسئلہ لکھیں:\n >> ")
    
    print("\nPipeline starting...\n")
    
    final_output = None
    detected_language = "English"
    
    try:
        async for event in run_pipeline_stream(user_text, input_type, cli_answer_callback):
            if event["type"] == "status":
                print(event["message"])
            elif event["type"] == "language":
                detected_language = event["language"]
            elif event["type"] == "error":
                print(f"\n❌ {event['message']}")
            elif event["type"] == "final":
                final_output = event["data"]
    except KeyboardInterrupt:
        print("\n" + GOODBYE.get(detected_language, "Exiting INSAAF OS. Goodbye!"))
        return
            
    if final_output is None:
        return
        
    print("\n" + "="*50)
    print("FINAL OUTPUT")
    print("="*50)
    print(json.dumps(final_output, indent=2))
    
    pdfs = final_output.get("pdf_files", [])
    if pdfs:
        print("\nGenerated PDFs:")
        for pdf in pdfs:
            print(f"- {pdf}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nExiting INSAAF OS. Goodbye! / Allah Hafiz!")
