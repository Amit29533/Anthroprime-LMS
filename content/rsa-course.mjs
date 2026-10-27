import modules from "./rsa-deck-modules.json" with { type: "json" };
import { communicationModule } from "./rsa-communication.mjs";
export function rsaCourse(roleId, competencyIds = []) {
  return {
    title: "RSA · Databricks Enterprise Readiness",
    summary: "Develop RSA architecture, data engineering, governance, consulting and communication skills. Twelve modules, 48 lessons and three MCQs after every lesson. Pass two out of three to continue, with retries. Labs, live simulations and independent readiness validation remain separate.",
    role_id: roleId, competency_ids: competencyIds, status: "published", level: "intermediate",
    outcomes: ["Design workload-led Databricks architectures and explain the trade-offs.", "Reason about reliable ingestion, transformations, pipelines and operations.", "Apply governance, security, performance and deployment principles.", "Structure discovery, recommendations and client objections using evidence.", "Communicate decisions clearly to executive and technical audiences."],
    curriculum: structuredClone([...modules, communicationModule]),
  };
}
