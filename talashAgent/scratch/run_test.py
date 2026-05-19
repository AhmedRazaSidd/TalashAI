import asyncio
import json
import sys
import os
from dotenv import load_dotenv
load_dotenv()

# Add parent directory to path so imports work
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.stdout.reconfigure(encoding='utf-8')

from pipeline import run_pipeline_stream

async def dummy_answer_callback(questions):
    print(f"\n[Interactive Questioning Agent] Questions requested: {questions}")
    answers = []
    for q in questions:
        print(f"Answering question: {q['question']}")
        answers.append({
            "id": q["id"],
            "answer": "Yes, I have a written rent agreement."
        })
    return answers

async def main():
    query = "Mere landlord ne deposit return nahi ki"
    print(f"Starting pipeline with input: '{query}'\n")
    
    async for event in run_pipeline_stream(query, "text", dummy_answer_callback):
        if event["type"] == "status":
            print(f"\n>>> STATUS: {event['message']}")
        elif event["type"] == "language":
            print(f">>> LANGUAGE DETECTED: {event['language']}")
        elif event["type"] == "final":
            print("\n=================== FINAL OUTPUT OF ALL 8 AGENTS ===================")
            # Pretty print the final dictionary context containing results of all agents
            print(json.dumps(event["data"], indent=2, ensure_ascii=False))
            print("====================================================================")

if __name__ == "__main__":
    asyncio.run(main())
