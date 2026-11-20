"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AccountUser, Role } from "../../services/auth";
import { searchUsers, setUserStatus, getAnalytics } from "../../services/admin";
import { createTeam, listTeams, setUserRole, setUserTeam, Team } from "../../services/rescue";
import { ConfirmDialog, Empty, Failed, Loading, Notice, PageHeader, Section, StatusPill, btnDanger, btnPrimary, btnQuiet, field, fmtTime } from "./ui";

const ROLE_TEXT: Record<Role, string> = { user: "User", rescuer: "Rescuer (field responder)", admin: "Platform admin" };
const PAGE = 25;

type Pending =
  | { kind: "role"; user: AccountUser; role: Role }
  | { kind: "status"; user: AccountUser; status: "active" | "suspended" }
  | null;

export const UsersSection: React.FC<{ me: { id: string } }> = ({ me }) => {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [skip, setSkip] = useState(0);
  const [data, setData] = useState<{ total: number; users: AccountUser[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selected, setSelected] = useState<AccountUser | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    searchUsers({ q: query, role, status, skip, limit: PAGE })
      .then((r) => setData({ total: r.total, users: r.users }))
      .catch((e) => setError((e as Error).message));
  }, [query, role, status, skip]);
  useEffect(load, [load]);
  useEffect(() => {
    listTeams().then(setTeams).catch(() => setTeams([]));
  }, []);

  const changeTeam = async (u: AccountUser, teamId: string) => {
    try {
      const after = await setUserTeam(u.id, teamId || null);
      setNotice(`${after.name}: team ${after.team ? `set to ${after.team.name}` : "removed"}.`);
      setSelected(after);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        lead="Every account. New accounts are always ordinary users; staff register themselves and an admin then grants the role here. Passwords are never shown or set by admins."
      />
      {notice && <Notice tone="ok">{notice}</Notice>}
      <form
        className="grid gap-3 rounded-2xl border border-rk-line bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto]"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setSkip(0);
          setQuery(q);
        }}
      >
        <label className="text-sm font-semibold text-rk-ink">
          Search name or email
          <input className={`${field} mt-1`} value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
        </label>
        <label className="text-sm font-semibold text-rk-ink">
          Role
          <select className={`${field} mt-1`} value={role} onChange={(e) => (setSkip(0), setRole(e.target.value))}>
            <option value="">All roles</option>
            <option value="user">Users</option>
            <option value="rescuer">Rescuers</option>
            <option value="admin">Admins</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-rk-ink">
          Status
          <select className={`${field} mt-1`} value={status} onChange={(e) => (setSkip(0), setStatus(e.target.value))}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <button type="submit" className={`${btnPrimary} self-end`}>Search</button>
      </form>

      {error && <Failed what="the accounts" message={error} onRetry={load} />}
      {!data && !error && <Loading what="accounts" />}
      {data && (
        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <Section title={`${data.total} account${data.total === 1 ? "" : "s"}`} id="users-list"
            aside={<span className="text-xs text-rk-muted">{data.total ? `${skip + 1}–${skip + data.users.length}` : ""}</span>}>
            {data.users.length === 0 ? (
              <Empty title="No account matches">Try another search or remove a filter.</Empty>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-rk-muted">
                    <tr><th className="py-2 pr-3 font-semibold">Name</th><th className="py-2 pr-3 font-semibold">Role</th><th className="py-2 pr-3 font-semibold">Team</th><th className="py-2 pr-3 font-semibold">Status</th><th className="py-2 pr-3 font-semibold">Registered</th><th className="py-2 font-semibold"><span className="sr-only">Open</span></th></tr>
                  </thead>
                  <tbody className="divide-y divide-rk-line">
                    {data.users.map((u) => (
                      <tr key={u.id} className={selected?.id === u.id ? "bg-rk-brand-soft" : ""}>
                        <td className="py-2 pr-3"><span className="font-semibold text-rk-ink">{u.name}</span><span className="block text-xs text-rk-muted">{u.email}</span></td>
                        <td className="py-2 pr-3">{ROLE_TEXT[u.role]}</td>
                        <td className="py-2 pr-3">{u.team?.name || "—"}</td>
                        <td className="py-2 pr-3"><StatusPill status={u.status || "active"} /></td>
                        <td className="py-2 pr-3 whitespace-nowrap text-rk-muted">{fmtTime(u.created_at)}</td>
                        <td className="py-2 text-right"><button type="button" className={btnQuiet} onClick={() => setSelected(u)} aria-label={`Open ${u.name}`}>Open</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 flex justify-between">
              <button type="button" className={btnQuiet} disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>Previous</button>
              <button type="button" className={btnQuiet} disabled={skip + PAGE >= data.total} onClick={() => setSkip(skip + PAGE)}>Next</button>
            </div>
          </Section>

          <Section title={selected ? selected.name : "Account details"} id="user-detail">
            {!selected ? (
              <Empty title="Choose an account">Its role, team, status and activity appear here.</Empty>
            ) : (
              <div className="space-y-4 text-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                  <dt className="text-rk-muted">Email</dt><dd className="break-all">{selected.email}</dd>
                  <dt className="text-rk-muted">Account id</dt><dd className="font-mono text-xs break-all">{selected.id}</dd>
                  <dt className="text-rk-muted">Registered</dt><dd>{fmtTime(selected.created_at)}</dd>
                  <dt className="text-rk-muted">Last log in</dt><dd>{selected.last_login_at ? fmtTime(selected.last_login_at) : "Not recorded (before this was tracked, or never)"}</dd>
                  <dt className="text-rk-muted">Status</dt><dd><StatusPill status={selected.status || "active"} /></dd>
                </dl>
                {selected.id === me.id ? (
                  <p className="rounded-lg bg-rk-secondary px-3 py-2 text-rk-ink">This is your account. You cannot change your own role or status.</p>
                ) : (
                  <>
                    <label className="block font-semibold text-rk-ink">
                      Role
                      <select className={`${field} mt-1`} value={selected.role} onChange={(e) => setPending({ kind: "role", user: selected, role: e.target.value as Role })}>
                        {(["user", "rescuer", "admin"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_TEXT[r]}</option>)}
                      </select>
                    </label>
                    <label className="block font-semibold text-rk-ink">
                      Rescue team
                      <select className={`${field} mt-1`} value={selected.team?.id || ""} onChange={(e) => changeTeam(selected, e.target.value)} disabled={selected.role === "user"}>
                        <option value="">No team</option>
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.organization})</option>)}
                      </select>
                      {selected.role === "user" && <span className="text-xs font-normal text-rk-muted">Make the account a rescuer first.</span>}
                    </label>
                    {(selected.status || "active") === "active" ? (
                      <button type="button" className={btnDanger} onClick={() => setPending({ kind: "status", user: selected, status: "suspended" })}>Suspend account</button>
                    ) : (
                      <button type="button" className={btnPrimary} onClick={() => setPending({ kind: "status", user: selected, status: "active" })}>Reactivate account</button>
                    )}
                    <p className="text-xs text-rk-muted">Accounts are suspended, not deleted, so the history of their actions stays intact. Role and status changes are written to the audit log.</p>
                  </>
                )}
              </div>
            )}
          </Section>
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        title={pending?.kind === "role" ? "Change role?" : pending?.status === "suspended" ? "Suspend this account?" : "Reactivate this account?"}
        description={
          pending?.kind === "role"
            ? `${pending.user.name} will become: ${ROLE_TEXT[pending.role]}. It takes effect on their next request.`
            : pending?.kind === "status" && pending.status === "suspended"
            ? `${pending.user.name} will be logged out everywhere and cannot log in until reactivated.`
            : `${pending?.user.name} will be able to log in again.`
        }
        confirmLabel={pending?.kind === "role" ? "Change role" : pending?.kind === "status" && pending.status === "suspended" ? "Suspend" : "Reactivate"}
        danger={pending?.kind === "status" && pending.status === "suspended"}
        needReason={pending?.kind === "status"}
        onCancel={() => setPending(null)}
        onConfirm={async (reason) => {
          if (!pending) return;
          const after = pending.kind === "role" ? await setUserRole(pending.user.id, pending.role) : await setUserStatus(pending.user.id, pending.status, reason);
          setNotice(pending.kind === "role" ? `${after.name} is now: ${ROLE_TEXT[after.role]}.` : `${after.name} is now ${after.status}.`);
          setSelected(after);
          setPending(null);
          load();
        }}
      />
    </div>
  );
};

export const TeamsSection: React.FC = () => {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [rescuers, setRescuers] = useState<AccountUser[]>([]);
  const [activity, setActivity] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([listTeams(), searchUsers({ role: "rescuer", limit: 500 }), getAnalytics(30)])
      .then(([t, u, a]) => {
        setTeams(t);
        setRescuers(u.users);
        setActivity(Object.fromEntries(a.team_acceptances.filter((x) => x.team).map((x) => [x.team as string, x.accepted])));
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  const members = useMemo(() => {
    const m: Record<string, AccountUser[]> = {};
    rescuers.forEach((u) => u.team && (m[u.team.id] = [...(m[u.team.id] || []), u]));
    return m;
  }, [rescuers]);

  return (
    <div className="space-y-5">
      <PageHeader title="Rescue teams" lead="The teams on the shared rescue board. Put a rescuer in a team from Users. Teams are never deleted, so the request history that names them stays readable." />
      {notice && <Notice tone="ok">{notice}</Notice>}
      {error && <Failed what="the teams" message={error} onRetry={load} />}
      {!teams && !error && <Loading what="teams" />}
      {teams && (
        <Section title={`${teams.length} team${teams.length === 1 ? "" : "s"}`} id="teams-list"
          note="Acceptances: requests the team accepted in the last 30 days (from the requests' history). There is no coordinator role yet; each team acts for itself.">
          {teams.length === 0 ? (
            <Empty title="No teams yet">Create the first team below.</Empty>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-rk-muted">
                  <tr><th className="py-2 pr-3 font-semibold">Team</th><th className="py-2 pr-3 font-semibold">Organisation</th><th className="py-2 pr-3 font-semibold">Members</th><th className="py-2 pr-3 font-semibold">Status</th><th className="py-2 font-semibold">Acceptances (30 days)</th></tr>
                </thead>
                <tbody className="divide-y divide-rk-line">
                  {teams.map((t) => {
                    const ms = members[t.id] || [];
                    const active = ms.filter((u) => (u.status || "active") === "active").length;
                    return (
                      <tr key={t.id}>
                        <td className="py-2 pr-3 font-semibold text-rk-ink">{t.name}</td>
                        <td className="py-2 pr-3">{t.organization}</td>
                        <td className="py-2 pr-3">{ms.length ? ms.map((u) => u.name).join(", ") : "—"}</td>
                        <td className="py-2 pr-3"><StatusPill status={active ? "active" : "unknown"} label={active ? `${active} active` : "No active member"} /></td>
                        <td className="py-2 font-mono">{activity[t.name] ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
      <Section title="Create a team" id="team-new">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const t = await createTeam(name.trim(), org.trim());
              setNotice(`Team created: ${t.name} (${t.organization}).`);
              setName("");
              setOrg("");
              load();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <label className="text-sm font-semibold text-rk-ink">Team name<input className={`${field} mt-1`} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} /></label>
          <label className="text-sm font-semibold text-rk-ink">Organisation<input className={`${field} mt-1`} value={org} onChange={(e) => setOrg(e.target.value)} required minLength={2} maxLength={120} /></label>
          <button type="submit" className={`${btnPrimary} self-end`}>Create team</button>
        </form>
      </Section>
    </div>
  );
};
