export function buildAiTeacherRequest({
  message,
  action = "chat",
  task = "",
  tone = "natural",
  persona = "bangkok",
  profile = {},
  history = [],
}) {
  const payload = {
    message: String(message || "").trim(),
    action: task ? "context" : action,
    profile,
    history,
  };

  if (task) {
    payload.task = task;
    payload.tone = tone;
    payload.persona = persona;
  }

  return payload;
}

export function requireAiTeacherResponse(result) {
  const response = result?.data?.response;
  if (typeof response !== "string" || !response.trim()) {
    throw new Error("AI 老师返回了无效内容，请重试");
  }
  return response.trim();
}
