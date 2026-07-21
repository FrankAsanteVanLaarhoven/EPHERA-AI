"use client";

import { useCallback, useEffect, useState } from "react";
import { shortTime } from "@/lib/format";
import type { SecurityChallenge, SecurityQuestion, UserRow } from "@/lib/types";

type Props = {
  users: UserRow[];
  flash: (m: string) => void;
};

export function SecurityPanel({ users, flash }: Props) {
  const [questions, setQuestions] = useState<SecurityQuestion[]>([]);
  const [challenges, setChallenges] = useState<SecurityChallenge[]>([]);
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<SecurityQuestion["category"]>("identity");
  const [userId, setUserId] = useState(users[0]?.id || "user_demo");
  const [questionId, setQuestionId] = useState("");
  const [purpose, setPurpose] = useState("high_value_send");

  const load = useCallback(async () => {
    const r = await fetch("/api/security");
    const j = await r.json();
    setQuestions(j.questions || []);
    setChallenges(j.challenges || []);
    if (!questionId && j.questions?.[0]?.id) setQuestionId(j.questions[0].id);
  }, [questionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createQuestion() {
    if (!prompt.trim()) return;
    await fetch("/api/security", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "create_question",
        prompt,
        category,
        requiredFor: ["step_up", purpose],
      }),
    });
    setPrompt("");
    flash("Security question added");
    void load();
  }

  async function toggleQuestion(id: string, active: boolean) {
    await fetch("/api/security", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "question", id, active: !active }),
    });
    void load();
  }

  async function issue() {
    const u = users.find((x) => x.id === userId);
    await fetch("/api/security", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "issue_challenge",
        userId,
        userName: u?.name,
        questionId,
        purpose,
      }),
    });
    flash("Challenge issued to user");
    void load();
  }

  async function resolve(id: string, status: SecurityChallenge["status"]) {
    await fetch("/api/security", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "challenge", id, status }),
    });
    flash(`Challenge ${status}`);
    void load();
  }

  return (
    <div className="stack-lg">
      <div className="card glass-hero">
        <h3 className="section-title">Security questions · step-up verification</h3>
        <p className="lede">
          Bank-style knowledge questions for recovery, high-value sends, unfreeze, receive
          verification, and ops kill-switch confirmation. Pair with passkeys and future video calls.
        </p>
      </div>

      <div className="grid two">
        <div className="card">
          <h3 className="section-title">Question catalogue</h3>
          <div className="form-grid">
            <label className="full">
              New question
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. What is the name of your childhood street?"
              />
            </label>
            <label>
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value as SecurityQuestion["category"])}>
                <option value="identity">Identity</option>
                <option value="device">Device</option>
                <option value="transaction">Transaction</option>
                <option value="recovery">Recovery</option>
                <option value="ops">Ops</option>
              </select>
            </label>
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn primary" onClick={() => void createQuestion()}>
              Add question
            </button>
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>Prompt</th>
                  <th>Category</th>
                  <th>Required for</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <strong>{q.prompt}</strong>
                      <div className="mono msg">{q.id}</div>
                    </td>
                    <td>
                      <span className="tag info">{q.category}</span>
                    </td>
                    <td className="msg">{q.requiredFor.join(", ")}</td>
                    <td>
                      <button
                        type="button"
                        className={`toggle ${q.active ? "on" : ""}`}
                        onClick={() => void toggleQuestion(q.id, q.active)}
                      >
                        <span />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Issue challenge</h3>
          <div className="form-grid">
            <label>
              User
              <select value={userId} onChange={(e) => setUserId(e.target.value)}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Question
              <select value={questionId} onChange={(e) => setQuestionId(e.target.value)}>
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.prompt.slice(0, 48)}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Purpose
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </label>
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn primary" onClick={() => void issue()}>
              Issue challenge
            </button>
          </div>

          <h3 className="section-title" style={{ marginTop: 22 }}>
            Live challenges
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Purpose</th>
                  <th>When</th>
                  <th>Resolve</th>
                </tr>
              </thead>
              <tbody>
                {challenges.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.userName}</strong>
                      <div className="msg">{c.questionPrompt}</div>
                    </td>
                    <td>
                      <span
                        className={`tag ${
                          c.status === "passed" ? "success" : c.status === "failed" ? "error" : "warn"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="msg">{c.purpose}</td>
                    <td className="mono">{shortTime(c.createdAt)}</td>
                    <td>
                      {c.status === "pending" ? (
                        <div className="actions">
                          <button type="button" className="btn success" onClick={() => void resolve(c.id, "passed")}>
                            Pass
                          </button>
                          <button type="button" className="btn danger" onClick={() => void resolve(c.id, "failed")}>
                            Fail
                          </button>
                        </div>
                      ) : (
                        <span className="msg">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
