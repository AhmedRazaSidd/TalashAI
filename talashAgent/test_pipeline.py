import asyncio
import json
from pipeline import run_pipeline_stream

async def main():
    print("Testing Pipeline: Meri zameen pe qabza ho gaya hai")
    events = []
    async for event in run_pipeline_stream('Meri zameen pe qabza ho gaya hai', 'text'):
        events.append(event)
    
    with open("test_output.json", "w", encoding="utf-8") as f:
        json.dump(events, f, ensure_ascii=False, indent=2)
    print("Output written to test_output.json")

asyncio.run(main())
