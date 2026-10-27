export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function createEodClient({ apiUrl, webUrl, fetcher = fetch }) {
  if (!apiUrl)
    throw new Error("Set EOD_API_URL to the assessment platform API URL.");
  const base = new URL(apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/api/"
  )
    throw new Error(
      "EOD_API_URL must identify /api without credentials or query parameters.",
    );
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname);
  if (base.protocol !== "https:" && !(local && base.protocol === "http:"))
    throw new Error("The EOD connection must use HTTPS, except on localhost.");
  const website = new URL(webUrl || base.origin);
  if (website.origin !== base.origin || website.search || website.hash)
    throw new Error("EOD_WEB_URL must use the EOD API origin.");
  const client = {
    instance: base.href,
    webUrl: website.href.replace(/\/$/, ""),
    async call(route, { token, method = "GET", body } = {}) {
      if (
        !route.startsWith("/") ||
        route.startsWith("//") ||
        route.includes("..")
      )
        throw new Error("Invalid EOD route");
      let response;
      try {
        response = await fetcher(new URL(route.slice(1), base), {
          method,
          redirect: "error",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        throw new HttpError(
          503,
          "The assessment platform is unavailable. Your saved learning progress is safe. Please retry.",
        );
      }
      let data;
      try {
        data = await response.json();
      } catch {
        throw new HttpError(
          502,
          "The assessment platform returned an unreadable response. Please retry.",
        );
      }
      if (!response.ok)
        throw new HttpError(
          response.status >= 500 ? 503 : response.status,
          data?.error || "The assessment request could not be completed.",
        );
      return data;
    },
    async all(route, key, token) {
      const rows = [];
      for (let offset = 0; offset < 100000; offset += 500) {
        const page = await client.call(`${route}?limit=500&offset=${offset}`, {
          token,
        });
        if (!Array.isArray(page[key]))
          throw new HttpError(
            502,
            "The assessment platform returned an invalid list.",
          );
        rows.push(...page[key]);
        if (typeof page.total !== "number" || rows.length >= page.total)
          return rows;
        if (!page[key].length)
          throw new HttpError(
            502,
            "The assessment list ended before all records were received.",
          );
      }
      throw new HttpError(503, "This assessment list needs a narrower query.");
    },
    async tracks(token) {
      const result = await client.call("/admin/roles", { token });
      return (result.roles || [])
        .filter((role) => role.active !== false)
        .map((role) => ({
          id: role.id,
          key: role.key,
          name: role.name,
          question_count: role.default_question_count,
          assessor_id: role.default_assessor_id || "",
          bank_count: role.question_count,
        }));
    },
    async competencies(token, roleId) {
      const result = await client.call(
        `/admin/roles/${encodeURIComponent(roleId)}`,
        { token },
      );
      return (result.competencies || [])
        .filter((c) => c.active !== false)
        .map((c) => ({ id: c.id, key: c.key || "", name: c.name }));
    },
    async learningContext(token) {
      const result = await client.call("/candidate/assessments", { token });
      const assessments = (result.assessments || [])
        .filter((a) => ["scored", "validated"].includes(a.status))
        .sort((a, b) =>
          String(b.scored_at || "").localeCompare(String(a.scored_at || "")),
        );
      const reports = new Map();
      for (const row of assessments) {
        // Assessment list deliberately omits role IDs; the safe report supplies its track identity.
        const { report } = await client.call(
          `/candidate/reports/${encodeURIComponent(row.id)}`,
          { token },
        );
        if (report?.role?.id && !reports.has(report.role.id))
          reports.set(report.role.id, {
            id: row.id,
            role_id: report.role.id,
            overall_pct: report.overall_pct,
            report_json: { areas_to_improve: report.areas_to_improve || [] },
            role_name: report.role.name,
          });
      }
      return {
        candidate: result.candidate,
        reports,
        assessments: result.assessments || [],
      };
    },
  };
  return client;
}
