import asyncio
import pandas as pd
import math
from sqlalchemy.dialects.postgresql import insert
from app.db.database import AsyncSessionLocal
from app.models.domain import (
    CurriculumStage, CurriculumModule, CanDoOutcome,
    GrammarTag, FunctionTag, VocabularyDomainTag, PromotionGate
)

# File path to the excel file
EXCEL_PATH = r"e:\ai-language-tutor\backend\data\CEFR_Master_Curriculum_Tables.xlsx"

def _clean_val(v):
    if pd.isna(v):
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    return v

def _parse_json_tags(v):
    if pd.isna(v) or not isinstance(v, str):
        return []
    # e.g., "TAG1, TAG2" -> ["TAG1", "TAG2"]
    return [t.strip() for t in v.split(",") if t.strip()]

async def seed_data():
    print("Loading Excel file...")
    xls = pd.ExcelFile(EXCEL_PATH)
    
    async with AsyncSessionLocal() as session:
        # 1. GrammarTag
        if "GrammarTag" in xls.sheet_names:
            df = pd.read_excel(xls, "GrammarTag")
            records = df.to_dict("records")
            cleaned_records = [{k: _clean_val(v) for k, v in r.items()} for r in records]
            if cleaned_records:
                stmt = insert(GrammarTag).values(cleaned_records)
                stmt = stmt.on_conflict_do_nothing(index_elements=['grammar_tag'])
                await session.execute(stmt)
                print(f"Seeded {len(cleaned_records)} GrammarTags")
        
        # 2. FunctionTag
        if "FunctionTag" in xls.sheet_names:
            df = pd.read_excel(xls, "FunctionTag")
            records = df.to_dict("records")
            cleaned_records = [{k: _clean_val(v) for k, v in r.items()} for r in records]
            if cleaned_records:
                stmt = insert(FunctionTag).values(cleaned_records)
                stmt = stmt.on_conflict_do_nothing(index_elements=['function_tag'])
                await session.execute(stmt)
                print(f"Seeded {len(cleaned_records)} FunctionTags")
                
        # 3. VocabularyDomainTag
        if "VocabularyDomainTag" in xls.sheet_names:
            df = pd.read_excel(xls, "VocabularyDomainTag")
            records = df.to_dict("records")
            cleaned_records = [{k: _clean_val(v) for k, v in r.items()} for r in records]
            if cleaned_records:
                stmt = insert(VocabularyDomainTag).values(cleaned_records)
                stmt = stmt.on_conflict_do_nothing(index_elements=['vocab_domain_tag'])
                await session.execute(stmt)
                print(f"Seeded {len(cleaned_records)} VocabularyDomainTags")

        # 4. CurriculumStage
        if "CurriculumStage" in xls.sheet_names:
            df = pd.read_excel(xls, "CurriculumStage")
            records = df.to_dict("records")
            cleaned_records = [{k: _clean_val(v) for k, v in r.items()} for r in records]
            if cleaned_records:
                stmt = insert(CurriculumStage).values(cleaned_records)
                stmt = stmt.on_conflict_do_nothing(index_elements=['stage_id'])
                await session.execute(stmt)
                print(f"Seeded {len(cleaned_records)} CurriculumStages")

        # 5. CurriculumModule
        if "CurriculumModule" in xls.sheet_names:
            df = pd.read_excel(xls, "CurriculumModule")
            records = df.to_dict("records")
            cleaned_records = []
            for r in records:
                cr = {k: _clean_val(v) for k, v in r.items()}
                cr['grammar_tags'] = _parse_json_tags(cr.get('grammar_tags'))
                cr['function_tags'] = _parse_json_tags(cr.get('function_tags'))
                cr['vocabulary_domain_tags'] = _parse_json_tags(cr.get('vocabulary_domain_tags'))
                cr['scenario_family_tags'] = _parse_json_tags(cr.get('scenario_family_tags'))
                cleaned_records.append(cr)
            if cleaned_records:
                stmt = insert(CurriculumModule).values(cleaned_records)
                stmt = stmt.on_conflict_do_nothing(index_elements=['module_id'])
                await session.execute(stmt)
                print(f"Seeded {len(cleaned_records)} CurriculumModules")

        # 6. CanDoOutcome
        if "CanDoOutcome" in xls.sheet_names:
            df = pd.read_excel(xls, "CanDoOutcome")
            records = df.to_dict("records")
            cleaned_records = []
            for r in records:
                cr = {k: _clean_val(v) for k, v in r.items()}
                cr['critical_flag'] = bool(cr.get('critical_flag', False))
                cr['transfer_required'] = bool(cr.get('transfer_required', False))
                cr['grammar_tags'] = _parse_json_tags(cr.get('grammar_tags'))
                cr['function_tags'] = _parse_json_tags(cr.get('function_tags'))
                cr['vocabulary_domain_tags'] = _parse_json_tags(cr.get('vocabulary_domain_tags'))
                cleaned_records.append(cr)
            if cleaned_records:
                stmt = insert(CanDoOutcome).values(cleaned_records)
                stmt = stmt.on_conflict_do_nothing(index_elements=['cando_id'])
                await session.execute(stmt)
                print(f"Seeded {len(cleaned_records)} CanDoOutcomes")

        # 7. PromotionGate
        if "PromotionGate" in xls.sheet_names:
            df = pd.read_excel(xls, "PromotionGate")
            records = df.to_dict("records")
            cleaned_records = []
            for r in records:
                cr = {k: _clean_val(v) for k, v in r.items()}
                cr['required_transfer_pass'] = bool(cr.get('required_transfer_pass', True))
                cleaned_records.append(cr)
            if cleaned_records:
                stmt = insert(PromotionGate).values(cleaned_records)
                stmt = stmt.on_conflict_do_nothing(index_elements=['gate_id'])
                await session.execute(stmt)
                print(f"Seeded {len(cleaned_records)} PromotionGates")

        await session.commit()
        print("Commit successful!")

if __name__ == "__main__":
    asyncio.run(seed_data())
