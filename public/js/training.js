/** Shared local training dashboard view. All mutations use the host app's authenticated API client. */
export async function trainingDashboard(view, { api, esc }) {
  let data;
  let query = '';
  let access = '';
  let courseStatus = '';
  let notice = '';
  const expanded = new Set();
  const endpoint = '/admin/training';
  const percent = (v) => v === null || v === undefined ? '—' : `${v}%`;
  const label = (s) => ({ not_invited: 'Not invited', invited: 'Invited', active: 'Active', revoked: 'Revoked' })[s] || s;
  const progress = (p, title) => `<progress max="100" value="${p}" aria-label="${esc(title)}">${p}%</progress><span>${p}%</span>`;
  const mean = (values) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const run = async (button, fn) => {
    const old = button.textContent;
    button.disabled = true;
    button.textContent = "Updating…";
    button.setAttribute("aria-busy", "true");
    try { await fn(); data = await api(endpoint); if (view.isConnected) paint(); }
    catch (err) { if (!view.isConnected) return; const output = view.querySelector('[data-training-message]'); output.textContent = err.message; output.setAttribute('role', 'alert'); output.tabIndex = -1; output.focus(); }
    finally { if (button.isConnected) { button.disabled = false; button.textContent = old; button.removeAttribute("aria-busy"); } }
  };
  const paint = () => {
    const all = data.candidates;
    const enrollments = all.flatMap((c) => c.enrollments);
    const candidates = all.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(query.toLowerCase())
      && (!access || c.access === access)
      && (!courseStatus || (courseStatus === 'unassigned' ? !c.enrollments.length : c.enrollments.some((e) => courseStatus === 'completed' ? e.progress.complete : courseStatus === 'not_started' ? !e.progress.completed : e.progress.completed > 0 && !e.progress.complete))));
    view.innerHTML = `<section class="training-dashboard"><header class="training-heading"><div><h1>Training dashboard</h1></div><button class="training-button" data-refresh>Refresh progress</button></header>
      <div class="training-stats"><div><strong>${all.length}</strong><span>Candidates</span></div><div><strong>${all.filter((c) => ['active', 'invited'].includes(c.access)).length}</strong><span>With access</span></div><div><strong>${enrollments.filter((e) => e.progress.completed && !e.progress.complete).length}</strong><span>In progress</span></div><div><strong>${enrollments.filter((e) => e.progress.complete).length}</strong><span>Completed</span></div></div>
      <p class="training-message" data-training-message role="status">${esc(notice)}</p>
      <div class="training-actions"><form data-invite class="training-panel"><h2>Invite by email</h2><label>Email address<input name="email" type="email" required maxlength="254" autocomplete="off" placeholder="candidate@example.com"></label><button class="training-button primary" type="submit">Grant training access</button><small>No email is sent. Candidates sign in with their ECOD account.</small></form>
      <form data-assign class="training-panel"><h2>Assign a course</h2><label>Candidate<select name="candidate_id" required><option value="">Choose a candidate</option>${all.filter((c) => ['active', 'invited'].includes(c.access)).map((c) => `<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.email)}</option>`).join('')}</select></label><label>Course<select name="id" required><option value="">Choose a course</option>${data.courses.map((c) => `<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select></label><button class="training-button primary" type="submit">Assign course</button></form></div>
      <section class="training-panel"><h2>Candidate progression</h2><div class="training-filters"><label>Search candidates<input data-search type="search" value="${esc(query)}" placeholder="Name or email"></label><label>Training access<select data-access>${[['','All access states'],['not_invited','Not invited'],['invited','Invited'],['active','Active'],['revoked','Revoked']].map(([v,t])=>`<option value="${v}" ${access===v?'selected':''}>${t}</option>`).join('')}</select></label><label>Course status<select data-course-status>${[['','All course states'],['unassigned','No course assigned'],['not_started','Not started'],['in_progress','In progress'],['completed','Completed']].map(([v,t])=>`<option value="${v}" ${courseStatus===v?'selected':''}>${t}</option>`).join('')}</select></label></div>
      <p class="training-caption" role="status" aria-live="polite">${candidates.length} of ${all.length} candidates · Updated ${esc(new Date(data.generated_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }))}</p><div class="training-table-wrap" tabindex="0" role="region" aria-label="Training records"><table class="training-table"><thead><tr><th>Candidate</th><th>Access</th><th>Courses & progress</th><th>Actions</th></tr></thead><tbody>${candidates.map((c) => `<tr><td><strong>${esc(c.name)}</strong><small>${esc(c.email || (c.has_account ? 'Add an email to the ECOD account to invite' : 'No active ECOD account'))}</small></td><td><span class="training-status ${esc(c.access)}">${label(c.access)}</span></td><td>${c.enrollments.map((e) => `<div class="training-course"><strong>${esc(e.course.title)}</strong><small>${e.progress.complete ? 'Completed' : e.progress.completed ? 'In progress' : 'Not started'} · ${e.progress.completed}/${e.progress.total} lessons</small>${progress(e.progress.percent,e.course.title)}</div>`).join('') || '<small>No course assigned</small>'}</td><td>${c.invitation_id ? `<button class="training-button" data-access-id="${esc(c.invitation_id)}" data-status="${c.access === 'revoked' ? 'active' : 'revoked'}">${c.access === 'revoked' ? 'Restore access' : 'Revoke access'}</button>` : ''}${c.enrollments.length ? `<button class="training-button" data-detail="${esc(c.id)}" aria-expanded="${expanded.has(c.id)}">Lesson details</button>` : ''}</td></tr><tr data-detail-row="${esc(c.id)}" ${expanded.has(c.id) ? "" : "hidden"}><td colspan="4">${c.enrollments.map((e) => {
        const tested = e.training.lessons.filter((l) => l.attempts);
        return `<h3>${esc(e.course.title)}</h3><p>First attempt average: ${percent(mean(tested.map((l) => l.first_percent).filter((v) => v !== null)))} · Best score average: ${percent(mean(tested.map((l) => l.best_percent)))} · ${tested.length}/${e.training.lessons.filter((l) => l.question_count).length} lesson checks attempted</p><div class="training-modules">${e.training.modules.map((m) => `<div><strong>${esc(m.title)}</strong>${progress(m.percent,m.title)}</div>`).join('')}</div><table class="training-table"><thead><tr><th>Lesson</th><th>Completed</th><th>Attempts</th><th>First</th><th>Best</th><th>Latest</th></tr></thead><tbody>${e.training.lessons.map((l) => `<tr><td>${esc(l.title)}</td><td>${l.completed_at ? 'Yes' : 'No'}</td><td>${l.attempts}</td><td>${percent(l.first_percent)}</td><td>${percent(l.best_percent)}</td><td>${percent(l.latest_percent)}</td></tr>`).join('')}</tbody></table>`;
      }).join('')}</td></tr>`).join('') || '<tr><td colspan="4">No candidates match these filters.</td></tr>'}</tbody></table></div></section>
      <section class="training-panel"><h2>Invitation register</h2><p>Pending invitations activate when an ECOD candidate account uses that email. Revoking keeps progress.</p><div class="training-table-wrap" tabindex="0" role="region" aria-label="Training records"><table class="training-table"><thead><tr><th>Email</th><th>Account</th><th>Access</th><th>Action</th></tr></thead><tbody>${data.invitations.map((i) => `<tr><td>${esc(i.email)}</td><td>${i.user_id ? 'Linked to ECOD' : 'Pending ECOD account'}</td><td>${i.status === 'revoked' ? 'Revoked' : i.first_access_at ? 'Active' : 'Invited'}</td><td><button class="training-button" data-access-id="${esc(i.id)}" data-status="${i.status === 'revoked' ? 'active' : 'revoked'}">${i.status === 'revoked' ? 'Restore access' : 'Revoke access'}</button></td></tr>`).join('') || '<tr><td colspan="4">No invitations yet.</td></tr>'}</tbody></table></div></section></section>`;
    view.querySelector('[data-refresh]').onclick = (e) => run(e.currentTarget, async () => { notice = 'Progress refreshed.'; });
    view.querySelector('[data-invite]').onsubmit = (e) => { e.preventDefault(); const email = new FormData(e.currentTarget).get('email'); run(e.currentTarget.querySelector('button'), async () => { const r = await api(`${endpoint}/invitations`, { method: 'POST', body: { email } }); notice = r.notice; }); };
    view.querySelector('[data-assign]').onsubmit = (e) => { e.preventDefault(); const body = { ...Object.fromEntries(new FormData(e.currentTarget)), kind: 'course' }; run(e.currentTarget.querySelector('button'), async () => { await api(`${endpoint}/assign`, { method: 'POST', body }); notice = 'Course assigned. The candidate can start from My learning.'; }); };
    const search = view.querySelector('[data-search]');
    const filterSearch = (e) => { const position = e.target.selectionStart; query = e.target.value; paint(); const next = view.querySelector('[data-search]'); next.focus({ preventScroll: true }); if (position !== null) next.setSelectionRange(position, position); };
    search.oninput = filterSearch;
    search.onchange = filterSearch;
    view.querySelector('[data-access]').onchange = (e) => { access = e.target.value; paint(); };
    view.querySelector('[data-course-status]').onchange = (e) => { courseStatus = e.target.value; paint(); };
    view.querySelectorAll('[data-access-id]').forEach((b) => { b.onclick = () => run(b, async () => { await api(`${endpoint}/invitations/${b.dataset.accessId}`, { method: 'PUT', body: { status: b.dataset.status } }); notice = b.dataset.status === 'revoked' ? 'Training access revoked. Saved progress is preserved.' : 'Training access restored.'; }); });
    view.querySelectorAll('[data-detail]').forEach((b) => { b.onclick = () => { const row = [...view.querySelectorAll('[data-detail-row]')].find((r) => r.dataset.detailRow === b.dataset.detail); row.hidden = !row.hidden; if (row.hidden) expanded.delete(b.dataset.detail); else expanded.add(b.dataset.detail); b.setAttribute('aria-expanded', String(!row.hidden)); }; });
  };
  data = await api(endpoint);
  if (view.isConnected) paint();
}
