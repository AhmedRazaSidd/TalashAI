import os
import logging
import json
from pinecone import Pinecone
from gemini_client import get_vertex_client

EMBEDDING_MODEL = "gemini-embedding-001"
logger = logging.getLogger(__name__)

# --- Curated Fallback Legal Docs Database ---
LEGAL_DOCS_DATABASE = [
    {
        "law_name": "Specific Relief Act 1877",
        "section": "Section 8 & 9",
        "summary": "Suit by person dispossessed of immovable property. A person dispossessed without consent of immovable property otherwise than in due course of law may, by suit, recover possession thereof, notwithstanding any other title that may be set up.",
        "source": "Specific Relief Act 1877 (Pakistan)",
        "keywords": ["qabza", "possession", "dispossessed", "property dispute", "land", "illegal occupant", "owner", "civil suit"]
    },
    {
        "law_name": "Land Revenue Act 1967",
        "section": "Section 42",
        "summary": "Mutation of land records (Inteqal). Requires reporting of acquisition of rights to the Patwari / Revenue Officer who enters mutation in the register and forwards it for formal verification.",
        "source": "Land Revenue Act 1967 (Pakistan)",
        "keywords": ["inteqal", "mutation", "patwari", "land record", "registry", "fard", "title deed", "revenue officer"]
    },
    {
        "law_name": "Transfer of Property Act 1882",
        "section": "Section 54",
        "summary": "Sale of immovable property. Sale is a transfer of ownership in exchange for a price paid or promised. Transfer of tangible immovable property of value of Rs. 100 or upwards must be made by registered instrument.",
        "source": "Transfer of Property Act 1882 (Pakistan)",
        "keywords": ["registry", "sale deed", "property sale", "transfer ownership", "title deed", "buyer", "seller"]
    },
    {
        "law_name": "Code of Criminal Procedure 1898",
        "section": "Section 154",
        "summary": "Information in cognizable cases (First Information Report - FIR). Every information relating to the commission of a cognizable offence, if given orally to an officer in charge of a police station, shall be reduced to writing.",
        "source": "Code of Criminal Procedure 1898 (Pakistan)",
        "keywords": ["fir", "police", "sho", "police station", "complaint", "criminal case", "offence", "arrest"]
    },
    {
        "law_name": "Prevention of Electronic Crimes Act 2016",
        "section": "Section 13 & 14",
        "summary": "Identity theft and unauthorized use of identity. Intentional and unauthorized transmission or use of personal identity information is punishable by imprisonment up to 3 years or fine.",
        "source": "PECA 2016 (Pakistan)",
        "keywords": ["cybercrime", "fia", "fraud", "identity theft", "online scam", "bank hack", "hacked", "whatsapp scam"]
    },
    {
        "law_name": "Muslim Family Laws Ordinance 1961",
        "section": "Section 9",
        "summary": "Maintenance of wife and children. If a husband fails to maintain his wife adequately, she or the Union Council may apply for an order directing the husband to pay reasonable maintenance.",
        "source": "Muslim Family Laws Ordinance 1961 (Pakistan)",
        "keywords": ["maintenance", "kharch", "family court", "wife support", "child support", "divorce", "union council"]
    },
    {
        "law_name": "Succession Act 1925",
        "section": "Section 372",
        "summary": "Application for Succession Certificate. Used to claim debts, bank accounts, shares, and movable assets of a deceased person in Civil Court or NADRA.",
        "source": "Succession Act 1925 (Pakistan)",
        "keywords": ["inheritance", "succession", "wirasat", "deceased", "bank account", "death certificate", "shares", "waris"]
    }
]

# --- Curated Court Procedures Database ---
COURT_PROCEDURES_DATABASE = {
    "property_dispute": {
        "procedural_steps": [
            "1. Obtain a certified copy of the Land Registry (Title Deed) or Fard from the Arazi Record Center (Tehsil office).",
            "2. Send a legal notice to the illegal occupant/opponent demanding vacation of property within 15 days.",
            "3. If unresolved, draft and file a Civil Suit for Recovery of Possession under Section 8 or 9 of the Specific Relief Act 1877.",
            "4. File a petition for a Temporary Injunction (Stay Order) under Order 39 Rules 1 & 2 of CPC to prevent further sale or construction.",
            "5. Present evidence (witnesses, revenue records) during the trial in the Civil Court."
        ],
        "guidance": "Consult the Civil Court in the district where the property is located. Be sure to check mutation records (Inteqal) to verify no unauthorized transfers have occurred.",
        "timelines": "Civil suits for possession typically take 1 to 3 years to resolve in Civil Courts. Stay orders are usually processed within 2 to 4 weeks."
    },
    "police_issue": {
        "procedural_steps": [
            "1. Visit the nearest Police Station (Thana) and submit a written application to the SHO detailing the criminal offense.",
            "2. Ensure the SHO registers the First Information Report (FIR) under Section 154 of CrPC and provides a free certified copy.",
            "3. If the SHO refuses to register the FIR, file a written complaint to the District Superintendent of Police (SP).",
            "4. If still refused, file a Petition under Section 22-A / 22-B of CrPC in the court of the Sessions Judge (Ex-Officio Justice of Peace).",
            "5. The Justice of Peace will direct the police to register the FIR if a cognizable offense is made out."
        ],
        "guidance": "Keep all evidence of the crime (photos, chat records, call logs) secure. Never pay any bribes to register an FIR.",
        "timelines": "FIR registration is immediate by law. A 22-A petition takes 1 to 3 weeks to resolve in Sessions Court."
    },
    "cybercrime_fraud": {
        "procedural_steps": [
            "1. Gather all evidence of the electronic scam (screenshots, transaction receipts, bank statements, phone numbers).",
            "2. Submit an online complaint on the official FIA Cybercrime portal (nr3c.gov.pk).",
            "3. Visit the nearest FIA Cybercrime Reporting Center (CCRC) to submit a physical application and verify your identity.",
            "4. The FIA will conduct an inquiry and track the fraudulent IP addresses or bank accounts.",
            "5. If a criminal offense under PECA 2016 is confirmed, an FIR will be registered and suspects arrested."
        ],
        "guidance": "Report cyber financial fraud within 24 hours to your bank to freeze transactions, and immediately file with the FIA.",
        "timelines": "FIA inquiries take 1 to 3 months. Freezing fraudulent bank accounts is done within 48 hours of reporting."
    },
    "general": {
        "procedural_steps": [
            "1. Draft a formal written complaint detailing your grievance, dates, and evidence.",
            "2. Consult a licensed legal counsel or visit the District Legal Education Committee (DLEC) for advice.",
            "3. Initiate mediation or send a formal legal notice to the opposing party.",
            "4. File a suit or application in the appropriate administrative or judicial forum."
        ],
        "guidance": "Check the exact jurisdiction before filing any lawsuit to prevent dismissal on technical grounds.",
        "timelines": "Varies depending on the administrative forum, usually 3 to 12 months."
    }
}

# --- Curated Legal Aid Database ---
LEGAL_AID_DATABASE = [
    {
        "name": "District Legal Education Committee (DLEC)",
        "location": "All Districts across Pakistan (located within District Court premises)",
        "service": "Provides free legal representation and aid to indigent litigants, women, and children.",
        "contact": "Contact the District & Sessions Judge office in your local District Court."
    },
    {
        "name": "Legal Aid Society (Karachi)",
        "location": "Karachi, Sindh",
        "service": "Free legal aid, awareness, and mediation services for marginalized communities.",
        "contact": "Phone: +92-21-35630071, Web: las.org.pk"
    },
    {
        "name": "Punjab Bar Council Legal Aid Committee",
        "location": "Lahore, Punjab",
        "service": "Free legal aid and representation in courts for deserving litigants.",
        "contact": "Office: Punjab Bar Council, Fane Road, Lahore."
    },
    {
        "name": "AGHS Legal Aid Cell",
        "location": "Lahore, Punjab",
        "service": "Free legal representation, focusing on human rights, women, and child protection.",
        "contact": "Phone: +92-42-35169054"
    }
]

# --- 1. Search Legal Docs (Vector / Curated hybrid) ---
def search_legal_docs(query: str, category: str = None, on_trace=None) -> list:
    """
    Search Pakistani legal documents. Checks Pinecone first (vector RAG).
    Falls back to curated database with tf-idf/keyword matching on error or if unconfigured.
    """
    if on_trace:
        on_trace("🔍 Searching Pakistani penal codes and case laws...")

    # Pinecone Vector Search Attempt
    try:
        api_key = os.getenv("PINECONE_API_KEY")
        index_name = os.getenv("PINECONE_INDEX")
        if api_key and index_name:
            pc = Pinecone(api_key=api_key)
            if index_name in pc.list_indexes().names():
                index = pc.Index(index_name)
                client = get_vertex_client()
                response = client.models.embed_content(
                    model=EMBEDDING_MODEL,
                    contents=query,
                )
                vector = response.embeddings[0].values
                results = index.query(vector=vector, top_k=5, include_metadata=True)
                
                matches = []
                for m in results.matches:
                    if m.score > 0.3:
                        meta = m.metadata or {}
                        matches.append({
                            "law_name": meta.get("law_name", "Penal Code / Statute"),
                            "section": meta.get("section", "Section Reference"),
                            "summary": meta.get("text", ""),
                            "source": meta.get("source", "Pinecone Legal Index")
                        })
                if matches:
                    if on_trace:
                        on_trace(f"📚 Retrieved {len(matches)} relevant legal references from Vector Store.")
                    return matches
    except Exception as e:
        logger.warning(f"Pinecone vector query failed, falling back to curated local lookup: {e}")

    # Curated Database Keyword Fallback
    query_lower = query.lower()
    matches = []
    for item in LEGAL_DOCS_DATABASE:
        score = 0
        for kw in item["keywords"]:
            if kw in query_lower:
                score += 1
        if score > 0:
            matches.append((score, {
                "law_name": item["law_name"],
                "section": item["section"],
                "summary": item["summary"],
                "source": item["source"]
            }))
            
    matches.sort(key=lambda x: x[0], reverse=True)
    top_matches = [m[1] for m in matches[:4]]
    
    # If no keyword matches, return default laws
    if not top_matches:
        top_matches = [{
            "law_name": LEGAL_DOCS_DATABASE[0]["law_name"],
            "section": LEGAL_DOCS_DATABASE[0]["section"],
            "summary": LEGAL_DOCS_DATABASE[0]["summary"],
            "source": LEGAL_DOCS_DATABASE[0]["source"]
        }]

    if on_trace:
        on_trace(f"📚 Retrieved {len(top_matches)} relevant legal references from local statutory index.")
        
    return top_matches

# --- 2. Search Court Procedures ---
def search_court_procedures(query: str, category: str = None, on_trace=None) -> dict:
    """
    Retrieves legal steps, timeline, and jurisdiction details.
    """
    if on_trace:
        on_trace("⚖️ Retrieving court jurisdiction, process, and administrative timelines...")

    query_lower = query.lower()
    matched_cat = "general"

    if "qabza" in query_lower or "land" in query_lower or "property" in query_lower or "dispute" in query_lower or "inteqal" in query_lower:
        matched_cat = "property_dispute"
    elif "fir" in query_lower or "police" in query_lower or "arrest" in query_lower or "sho" in query_lower or "criminal" in query_lower:
        matched_cat = "police_issue"
    elif "cyber" in query_lower or "fia" in query_lower or "scam" in query_lower or "fraud" in query_lower or "hack" in query_lower:
        matched_cat = "cybercrime_fraud"

    res = COURT_PROCEDURES_DATABASE[matched_cat]
    
    if on_trace:
        on_trace(f"📋 Loaded {len(res['procedural_steps'])} procedural steps for category: {matched_cat.replace('_', ' ').title()}")
        
    return res

# --- 3. Search Legal Aid ---
def search_legal_aid(query: str, on_trace=None) -> list:
    """
    Searches and retrieves free legal aid clinics and centers.
    """
    if on_trace:
        on_trace("🔍 Searching registered free legal aid providers and Bar Council committees...")

    query_lower = query.lower()
    matches = []
    
    # Match based on location or services
    for clinic in LEGAL_AID_DATABASE:
        if any(kw in query_lower for kw in ["karachi", "sindh"]) and "Karachi" in clinic["location"]:
            matches.append(clinic)
        elif any(kw in query_lower for kw in ["lahore", "punjab"]) and "Lahore" in clinic["location"]:
            matches.append(clinic)
            
    if not matches:
        matches = LEGAL_AID_DATABASE  # Return all by default

    if on_trace:
        on_trace(f"🤝 Located {len(matches)} free legal assistance resources available for your case.")
        
    return matches

# --- 4. Notice Draft Generator ---
def generate_notice(case_details: dict, on_trace=None) -> str:
    """
    Generates a formal legal notice to be sent to the opponent.
    """
    if on_trace:
        on_trace("📄 Drafting formal Legal Demand Notice to opponent...")

    facts = case_details.get("cleaned_input", "Claim details unspecified.")
    notice_text = (
        "LEGAL NOTICE DEMAND\n"
        "===================\n\n"
        "To,\n"
        "[Opposing Party Name / Respondent]\n"
        "[Address of the Opposing Party]\n\n"
        "SUBJECT: LEGAL NOTICE FOR VACATION OF POSSESSION / RETURN OF DUES UNDER PAKISTANI LAW\n\n"
        "Under instructions from my client, I hereby serve you with this Legal Notice:\n\n"
        f"1. That my client is the rightful claimant of the dispute arising from the following facts: {facts}.\n"
        "2. That your current actions are a direct violation of their rights under the laws of Pakistan.\n"
        "3. That you are hereby called upon to cease your illegal actions, vacate the dispute territory, or pay the outstanding damages immediately.\n\n"
        "You are given fifteen (15) days from the receipt of this legal notice to comply with these terms, failing which my client has direct instructions to initiate civil/criminal proceedings against you in the court of competent jurisdiction at your risk and cost.\n\n"
        "Yours faithfully,\n"
        "[Advocate High Court]\n"
        "Counsel for Claimant"
    )
    return notice_text

# --- 5. Affidavit Generator ---
def generate_affidavit(case_details: dict, on_trace=None) -> str:
    """
    Generates a formal legal affidavit.
    """
    if on_trace:
        on_trace("📄 Drafting legal Solemn Affidavit / Statement under oath...")

    facts = case_details.get("cleaned_input", "Facts of the claim.")
    affidavit_text = (
        "AFFIDAVIT / SOLEMN DECLARATION\n"
        "==============================\n\n"
        "I, [Deponent Name], S/O [Father Name], Resident of [Address], do hereby solemnly affirm and declare on oath as under:\n\n"
        "1. That I am the deponent of this affidavit and fully conversant with the facts stated herein.\n"
        f"2. That the true facts of the dispute are as follows: {facts}.\n"
        "3. That all documents submitted in support of my claim are genuine, correct, and legally obtained.\n"
        "4. That whatever is stated above is true and correct to the best of my knowledge, and nothing has been concealed.\n\n"
        "DEPONENT:\n"
        "___________________\n"
        "CNIC No: [Deponent CNIC]\n\n"
        "VERIFICATION:\n"
        "Verified on oath at Lahore/Karachi this day that the contents of this affidavit are true to the best of my belief."
    )
    return affidavit_text

# --- 6. FIR Draft Generator ---
def generate_fir_draft(case_details: dict, on_trace=None) -> str:
    """
    Generates a formal FIR application to the SHO.
    """
    if on_trace:
        on_trace("📄 Drafting First Information Report (FIR) Application to SHO...")

    facts = case_details.get("cleaned_input", "Offense details.")
    fir_text = (
        "APPLICATION FOR REGISTRATION OF FIR\n"
        "====================================\n\n"
        "To,\n"
        "The Officer In-Charge (SHO),\n"
        "Police Station: [Local Police Station Name],\n"
        "[District Name]\n\n"
        "SUBJECT: APPLICATION FOR REGISTERING FIR FOR CRIMINAL OFFENSE UNDER PAKISTAN PENAL CODE (PPC)\n\n"
        "Respected Sir,\n\n"
        "It is respectfully submitted as under:\n"
        "1. That the applicant is a peaceful law-abiding citizen of Pakistan.\n"
        f"2. That on the specified date, a criminal offense occurred. Incident facts: {facts}.\n"
        "3. That the accused individuals committed cognizable offenses resulting in severe damages/loss.\n\n"
        "Therefore, it is requested that a case / FIR under the relevant sections of the Pakistan Penal Code (PPC) be registered against the accused persons immediately and they be investigated in accordance with law.\n\n"
        "Applicant Name:\n"
        "[Claimant Name]\n"
        "CNIC No: [Claimant CNIC]\n"
        "Contact No: [Claimant Phone]"
    )
    return fir_text
