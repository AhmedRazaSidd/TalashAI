import asyncio
import json
import os
import sys

# Ensure parent directory is in sys.path to find gemini_client and other tools
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from pipeline import run_pipeline_stream

async def run_e2e_test():
    print("=" * 80)
    print("                      TALASH AI - MANDATORY E2E TEST")
    print("=" * 80)
    print("Test Input: 'Mere bhai ne mujhe ghar se nikal diya'\n")

    user_problem = "Mere bhai ne mujhe ghar se nikal diya"
    collected_context = {}
    
    # --------------------------------------------------------------------------
    # Step 1: CaseListener
    # --------------------------------------------------------------------------
    print("\n--- [Pipeline] Starting Agent: CaseListener ---")
    agent1_out = None
    async for event in run_pipeline_stream(user_problem, "text", target_agent="CaseListener"):
        if event["type"] == "status":
            print(f" [Trace]: {event['message']}")
        elif event["type"] == "final":
            agent1_out = event["data"]
    
    print(" [Pipeline] Completed Agent: CaseListener")
    print(f" Facts Extracted: {agent1_out.get('final_output', {}).get('facts')}")
    print(f" Emotional State: {agent1_out.get('final_output', {}).get('emotional_state')}")
    print(f" Urgency Level: {agent1_out.get('final_output', {}).get('urgency_level')}")
    print(f" Language Detected: {agent1_out.get('final_output', {}).get('language')}")
    
    # Seed collected context
    collected_context.update(agent1_out.get("final_output", {}))
    
    # --------------------------------------------------------------------------
    # Step 2: CaseClassifier
    # --------------------------------------------------------------------------
    print("\n--- [Pipeline] Starting Agent: CaseClassifier ---")
    agent2_out = None
    async for event in run_pipeline_stream("", "text", prior_context=collected_context, target_agent="CaseClassifier"):
        if event["type"] == "status":
            print(f" [Trace]: {event['message']}")
        elif event["type"] == "final":
            agent2_out = event["data"]
            
    print(" [Pipeline] Completed Agent: CaseClassifier")
    print(f" Classified Case Type: {agent2_out.get('final_output', {}).get('case_type')}")
    print(f" Confidence %: {agent2_out.get('final_output', {}).get('confidence')}")
    print(f" Jurisdiction: {agent2_out.get('final_output', {}).get('jurisdiction')}")
    
    collected_context.update(agent2_out.get("final_output", {}))
    
    # --------------------------------------------------------------------------
    # Step 3: QuestioningAgent (Pause & Resume Loop)
    # --------------------------------------------------------------------------
    print("\n--- [Pipeline] Starting Agent: QuestioningAgent ---")
    agent3_out = None
    async for event in run_pipeline_stream("", "text", prior_context=collected_context, target_agent="QuestioningAgent"):
        if event["type"] == "status":
            print(f" [Trace]: {event['message']}")
        elif event["type"] == "final":
            agent3_out = event["data"]

    # Check pause condition
    if agent3_out.get("pause_for_user") is True:
        print(f"\n [Pipeline] Waiting For User Reply: QuestioningAgent")
        print(f" Question Asked: {agent3_out.get('question')}")
        print(f" Expected Info Field: {agent3_out.get('expected_input')}")
        
        # Simulate user reply
        simulated_reply = "Haan, mere paas zameen ki registry available hai aur boundaries clear hain."
        print(f" User Simulated Reply: '{simulated_reply}'")
        
        # Save response in context
        expected_field = agent3_out.get('expected_input', 'generic_reply')
        collected_context.setdefault("answers", {}).setdefault("QuestioningAgent", {})
        collected_context["answers"]["QuestioningAgent"][expected_field] = simulated_reply
        
        # Record question in investigation_memory
        inv_mem = collected_context.get("investigation_memory", {
            "already_asked_questions": [],
            "answered_topics": {},
            "missing_information": [],
            "confidence_score": 0.0
        })
        if agent3_out.get('question') not in inv_mem["already_asked_questions"]:
            inv_mem["already_asked_questions"].append(agent3_out.get('question'))
        collected_context["investigation_memory"] = inv_mem
        
        # Resume pipeline
        print("\n [Pipeline] Resuming Agent: QuestioningAgent")
        async for event in run_pipeline_stream("", "text", prior_context=collected_context, target_agent="QuestioningAgent"):
            if event["type"] == "status":
                print(f" [Trace]: {event['message']}")
            elif event["type"] == "final":
                agent3_out = event["data"]

    print(" [Pipeline] Completed Agent: QuestioningAgent")
    print(f" Investigation Confidence Score: {agent3_out.get('final_output', {}).get('investigation_memory', {}).get('confidence_score')}")
    collected_context.update(agent3_out.get("final_output", {}))
    
    # --------------------------------------------------------------------------
    # Step 4: RightsAnalyzer
    # --------------------------------------------------------------------------
    print("\n--- [Pipeline] Starting Agent: RightsAnalyzer ---")
    agent4_out = None
    async for event in run_pipeline_stream("", "text", prior_context=collected_context, target_agent="RightsAnalyzer"):
        if event["type"] == "status":
            print(f" [Trace]: {event['message']}")
        elif event["type"] == "final":
            agent4_out = event["data"]
            
    print(" [Pipeline] Completed Agent: RightsAnalyzer")
    rights_analysis = agent4_out.get('final_output', {}).get('rights_analysis', {})
    rights_list = rights_analysis.get('rights', [])
    for idx, item in enumerate(rights_list[:2]):
        print(f" Right {idx+1}: {item.get('right')}")
        print(f"   Explanation (Urdu): {item.get('explanation')}")
        print(f"   Law Reference: {item.get('law_reference')}")
    
    collected_context.update(agent4_out.get("final_output", {}))
    
    # --------------------------------------------------------------------------
    # Step 5: DocumentChecker
    # --------------------------------------------------------------------------
    print("\n--- [Pipeline] Starting Agent: DocumentChecker ---")
    agent5_out = None
    async for event in run_pipeline_stream("", "text", prior_context=collected_context, target_agent="DocumentChecker"):
        if event["type"] == "status":
            print(f" [Trace]: {event['message']}")
        elif event["type"] == "final":
            agent5_out = event["data"]
            
    print(" [Pipeline] Completed Agent: DocumentChecker")
    doc_check = agent5_out.get('final_output', {}).get('document_check', {})
    print(f" Case Readiness Score: {doc_check.get('readiness_score')}%")
    missing_docs = doc_check.get('documents_missing', [])
    if missing_docs:
        print(f" Missing Document Sample: {missing_docs[0]}")
        
    collected_context.update(agent5_out.get("final_output", {}))
    
    # --------------------------------------------------------------------------
    # Step 6: ActionPlanner
    # --------------------------------------------------------------------------
    print("\n--- [Pipeline] Starting Agent: ActionPlanner ---")
    agent6_out = None
    async for event in run_pipeline_stream("", "text", prior_context=collected_context, target_agent="ActionPlanner"):
        if event["type"] == "status":
            print(f" [Trace]: {event['message']}")
        elif event["type"] == "final":
            agent6_out = event["data"]
            
    print(" [Pipeline] Completed Agent: ActionPlanner")
    action_plan = agent6_out.get('final_output', {}).get('action_plan', {})
    print(f" Steps Roadmap Count: {len(action_plan.get('action_plan', []))}")
    print(f" Legal Aid Simulated: {action_plan.get('legal_aid_request_simulated')}")
    print(f" Legal Aid Confirmation: {action_plan.get('legal_aid_confirmation_number')}")
    
    collected_context.update(agent6_out.get("final_output", {}))
    
    # --------------------------------------------------------------------------
    # Step 7: MisguideDetector
    # --------------------------------------------------------------------------
    print("\n--- [Pipeline] Starting Agent: MisguideDetector ---")
    # Simulate first pause asking if they consulted lawyer
    print(" [Pipeline] Waiting For User Reply: MisguideDetector")
    print(" Question: Have you already consulted a lawyer about this case?")
    
    # Answer "Yes" to execute scam check
    print(" User Simulated Reply: 'Yes'")
    collected_context.setdefault("answers", {}).setdefault("MisguideDetector", {})
    collected_context["answers"]["MisguideDetector"]["consulted_lawyer"] = True
    
    # Run Detector
    agent7_out = None
    async for event in run_pipeline_stream("", "text", prior_context=collected_context, target_agent="MisguideDetector"):
        if event["type"] == "status":
            print(f" [Trace]: {event['message']}")
        elif event["type"] == "final":
            agent7_out = event["data"]
            
    # Check if lawyer detail question is asked
    if agent7_out.get("pause_for_user") is True:
        print(f"\n [Pipeline] Waiting For User Reply: MisguideDetector")
        print(f" Question: {agent7_out.get('question')}")
        
        simulated_advice = "Wakeel ne kaha 50,000 fees do aur kal hi faisla karwa dunga bina kisi court hearing ke."
        print(f" User Simulated Advice Detail: '{simulated_advice}'")
        
        collected_context["answers"]["MisguideDetector"]["lawyer_said"] = simulated_advice
        
        print("\n [Pipeline] Resuming Agent: MisguideDetector")
        async for event in run_pipeline_stream("", "text", prior_context=collected_context, target_agent="MisguideDetector"):
            if event["type"] == "status":
                print(f" [Trace]: {event['message']}")
            elif event["type"] == "final":
                agent7_out = event["data"]
                
    print(" [Pipeline] Completed Agent: MisguideDetector")
    scam_prot = agent7_out.get('final_output', {}).get('scam_protection', {})
    print(f" Scams Detected: {scam_prot.get('scam_detected')}")
    print(f" Red Flags: {scam_prot.get('flags')}")
    
    collected_context.update(agent7_out.get("final_output", {}))
    
    # --------------------------------------------------------------------------
    # Step 8: PDFFormatter
    # --------------------------------------------------------------------------
    print("\n--- [Pipeline] Starting Agent: PdfFormatter ---")
    agent8_out = None
    async for event in run_pipeline_stream("", "text", prior_context=collected_context, target_agent="PdfFormatter"):
        if event["type"] == "status":
            print(f" [Trace]: {event['message']}")
        elif event["type"] == "final":
            agent8_out = event["data"]
            
    print(" [Pipeline] Completed Agent: PdfFormatter")
    pdf_files = agent8_out.get('pdf_files', [])
    print(f" Generated PDF Files Count: {len(pdf_files)}")
    for fpath in pdf_files:
        print(f"   Created PDF: {os.path.basename(fpath)}")
        
    print("\n" + "=" * 80)
    print(" FINAL COMPLETION SUCCESS: Your legal assessment and documents are ready.")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_e2e_test())
