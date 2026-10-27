"""Local read-only OOXML import. No trainer notes, hidden cases or original files are served.
Usage: python scripts/build-rsa-course.py "D:/Downloads/4. Upskilling.zip"
"""
import io
import json
import hashlib
import pathlib
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main"}

def deck(raw):
    result = []
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        slides = sorted((s for s in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+.xml", s)), key=lambda s: int(re.search(r"(\d+)\.xml", s).group(1)))
        for number, name in enumerate(slides, 1):
            root = ET.fromstring(z.read(name))
            paragraphs = ["".join(t.text or "" for t in p.findall(".//a:t", NS)) for p in root.findall(".//a:p", NS)]
            notes = ""
            rel = f"ppt/slides/_rels/slide{number}.xml.rels"
            if rel in z.namelist():
                target = next((r.attrib["Target"] for r in ET.fromstring(z.read(rel)) if r.attrib["Type"].endswith("/notesSlide")), None)
                if target:
                    notes = "\n".join(t.text or "" for t in ET.fromstring(z.read("ppt/" + target.removeprefix("../"))).findall(".//a:t", NS))
            result.append({"slide": number, "paragraphs": [p.strip() for p in paragraphs if p.strip()], "notes": notes})
    return result

def questions(slide):
    ps = slide["paragraphs"]
    result = []
    for i, p in enumerate(ps):
        if not re.fullmatch(r"Q\d", p) or i + 2 >= len(ps):
            continue
        choices = re.findall(r"([A-D])\)\s*(.*?)(?=\s+[A-D]\)|$)", ps[i+2], flags=re.S)
        if len(choices) != 4:
            continue  # Open questions remain facilitator exercises, not MCQs.
        key = re.search(rf"{p}:\s*([A-D])\s*[—–-]\s*(.*?)(?=\s+Q\d(?:\s*\(|:)|$)", slide["notes"], flags=re.S)
        if not key:
            raise ValueError(f"No verified answer for slide {slide['slide']} {p}")
        explanation = key.group(2).strip()
        explanation = re.split(r"Do not (?:advance|proceed)|This closes the teach", explanation)[0].strip()
        explanation = re.sub(r"\s+\d+$", "", explanation)
        result.append({"prompt": ps[i+1], "choices": choices, "correct": key.group(1), "explanation": explanation, "source_slide": slide["slide"], "source_question": p})
    return result

def learner_slide(slide):
    ps = slide["paragraphs"]
    if any("KNOWLEDGE CHECK" in p for p in ps[:3]):
        return ""
    # No presenter-only cues or notes, hidden-fact slides or independent exam vignettes.
    assert not any("HIDDEN FACTS" in p or "facilitator only" in p.lower() for p in ps[:3])
    content = ps[1:]
    if content and content[-1].isdigit():
        content = content[:-1]
    cut = next((i for i, p in enumerate(content) if p.startswith("TRAINER EMPHASIS")), len(content))
    content = content[:cut]
    content = [p for p in content if p not in ["↓", "→", "←"]]
    if not content:
        return ""
    # De-duplicate the all-caps topic label; the next line is the explanatory heading.
    heading = content[1] if len(content) > 1 else content[0]
    rest = content[2:] if len(content) > 1 else []
    rest = [p.replace("WHAT THE CANDIDATE MUST UNDERSTAND", "Core ideas") for p in rest]
    text = "## " + heading + "\n\n" + "\n".join(rest)
    text = text.replace("Storage: always in the customer's cloud object storage — never inside either plane", "Storage is separate from compute. The storage account and operating responsibility depend on the workspace and storage configuration; serverless workspaces can use Databricks-managed default storage.")
    text = text.replace("STORAGE — always in customer cloud object storage (Delta Lake / Apache Iceberg) — the one copy both planes read and write", "STORAGE — governed object storage, separate from compute. Account ownership depends on the workspace and storage configuration, including Databricks-managed default storage.")
    text = text.replace("One governed copy of data, in the customer's own cloud object storage — every engine above reads and writes it directly; nothing is copied to feed a different tool", "Governed tables in object storage can serve multiple engines without each team maintaining its own independent copy. Storage ownership and supported access depend on the workspace and storage configuration.")
    return text

def main():
    archive = pathlib.Path(sys.argv[1])
    modules = []
    manifest = []
    with zipfile.ZipFile(archive) as z:
        names = [n for n in z.namelist() if n.endswith(".pptx")]
        names.sort(key=lambda n: (0 if pathlib.PurePosixPath(n).name.startswith("T") else 1, n))
        for name in names:
            raw = z.read(name)
            slides = deck(raw)
            code = pathlib.PurePosixPath(name).name.split("-")[0]
            if code.startswith("C01"):
                code = "C01-C02"
            elif code.startswith("C03"):
                code = "C03-C04"
            boundaries = [(int(s["paragraphs"][0]), i) for i, s in enumerate(slides) if s["paragraphs"][0].isdigit() and len(s["paragraphs"][0]) == 2]
            sections = {n: slides[i: next((j for _, j in boundaries if j > i), len(slides))] for n, i in boundaries}
            assert all(n in sections for n in range(2, 10)), name
            lessons = []
            for i, start in enumerate([2, 4, 6, 8]):
                pair = [sections[start], sections[start+1]]
                titles = [chapter[0]["paragraphs"][1] for chapter in pair]
                bodies = []
                if i == 0:
                    case = [learner_slide(s) for s in sections[1][1:3]]
                    bodies += ["## Your learning goal\n\n" + slides[0]["paragraphs"][2], "## Practice case\n\nThe following organization is an illustrative training case from the supplied deck.", *case]
                pools = []
                for chapter in pair:
                    bodies += [learner_slide(s) for s in chapter[1:] if not any("KNOWLEDGE CHECK" in p for p in s["paragraphs"][:3])]
                    pool = [q for s in chapter for q in questions(s)]
                    assert len(pool) >= 2, (name, titles, pool)
                    pools.append(pool)
                selected = [pools[0][0], pools[0][1], pools[1][0]] if i % 2 == 0 else [pools[0][0], pools[1][0], pools[1][1]]
                qs = []
                for qi, q in enumerate(selected):
                    # The original decks heavily favor option B. Rotate choices to remove that clue.
                    shift = (len(modules) + i + qi) % 4
                    choices = q["choices"][shift:] + q["choices"][:shift]
                    correct = next(j for j, (letter, _) in enumerate(choices) if letter == q["correct"])
                    qs.append({"id": f"{code.lower()}-l{i+1}-q{qi+1}", "prompt": q["prompt"], "options": [{"id": f"o{j}", "label": label.strip()} for j, (_, label) in enumerate(choices)], "correct_option_id": f"o{correct}", "explanation": q["explanation"]})
                first = pair[0][0]["slide"]
                last = pair[1][-1]["slide"]
                bodies += [f"## Apply it\n\nUse the practice case to explain one decision these topics change. Name the requirement, an alternative and the trade-off. The three questions below check your understanding. Pass at least two to unlock the next lesson; you can retry.", f"Source: {pathlib.PurePosixPath(name).name}, slides {"5–6 and " if i == 0 else ""}{first}–{last}. Adapted for self-paced reading. Live demonstrations, hidden scenario facts and independent assessment material remain outside this course."]
                body = "\n\n".join(b for b in bodies if b)
                if code == "T01" and start == 6:
                    body += "\n\nArchitecture update (27 October 2026): default storage can be Databricks-managed. Do not assume all data is always stored in a customer-owned account. Check the workspace and storage configuration. Reference: https://docs.databricks.com/aws/en/storage/default-storage"
                # Replace an outdated, absolute storage-location question with a configuration-aware check.
                for q in qs:
                    if code == "T01" and "Where does storage live" in q["prompt"]:
                        q.update(prompt="Which statement correctly describes storage placement in Databricks?", options=[{"id":"o0","label":"Every workspace stores all data inside its compute cluster."},{"id":"o1","label":"Storage ownership depends on workspace configuration; serverless workspaces can use Databricks-managed default storage."},{"id":"o2","label":"Customer-owned cloud storage is mandatory for every workspace type."},{"id":"o3","label":"Unity Catalog removes the need for object storage."}],correct_option_id="o1",explanation="Storage is separate from compute. Current Databricks guidance includes managed default storage, so ownership must be checked for the actual workspace configuration.")
                lessons.append({"id": f"rsa-{code.lower()}-l{i+1}", "title": " & ".join(titles)[:160], "kind": "article", "minutes": max(12, min(35, round(len(body.split()) / 150) + 8)), "body": body, "resource_url": "", "quiz": {"pass_percent": 66, "questions": qs}})
                manifest.append({"module": code, "lesson": lessons[-1]["id"], "file": name, "sha256": hashlib.sha256(raw).hexdigest(), "slides": [first, last], "case_slides": [5, 6] if i == 0 else [], "questions": [{"slide": q["source_slide"], "question": q["source_question"]} for q in selected]})
            modules.append({"id": f"rsa-{code.lower()}", "title": f"{code} · {slides[0]['paragraphs'][1]}", "lessons": lessons})
    (ROOT / "content/rsa-deck-modules.json").write_text(json.dumps(modules, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / "content/rsa-source-map.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Imported {len(modules)} modules, {sum(len(m['lessons']) for m in modules)} lessons. Communication module is added by rsa-course.mjs.")

if __name__ == "__main__":
    main()
