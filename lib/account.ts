import { getSupabase } from "@/lib/supabase";
import { parseCitations, threadTitle, type ChatCitation } from "@/lib/account-utils";

export type FavoriteRow = { model_id: string; created_at: string };

export type ComparisonRow = {
  id: string;
  name: string;
  model_ids: string[];
  created_at: string;
};

export type ThreadRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ChatCitation[];
  created_at: string;
};

function db() {
  const client = getSupabase();
  if (!client) throw new Error("账号服务未配置");
  return client;
}

export async function listFavorites(userId: string): Promise<FavoriteRow[]> {
  const { data, error } = await db()
    .from("favorites")
    .select("model_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as FavoriteRow[];
}

export async function addFavorite(userId: string, modelId: string): Promise<void> {
  const { error } = await db()
    .from("favorites")
    .upsert(
      { user_id: userId, model_id: modelId },
      { onConflict: "user_id,model_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function removeFavorite(userId: string, modelId: string): Promise<void> {
  const { error } = await db()
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("model_id", modelId);
  if (error) throw error;
}

export async function listComparisons(userId: string): Promise<ComparisonRow[]> {
  const { data, error } = await db()
    .from("saved_comparisons")
    .select("id, name, model_ids, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as ComparisonRow[];
}

export async function saveComparison(
  userId: string,
  name: string,
  modelIds: string[],
): Promise<ComparisonRow> {
  const ids = [...new Set(modelIds)].slice(0, 4);
  if (ids.length < 2) throw new Error("至少选择 2 个型号");
  const cleanName = name.replace(/\s+/g, " ").trim().slice(0, 60) || "未命名对比";
  const { data, error } = await db()
    .from("saved_comparisons")
    .insert({ user_id: userId, name: cleanName, model_ids: ids })
    .select("id, name, model_ids, created_at")
    .single();
  if (error) throw error;
  return data as ComparisonRow;
}

export async function deleteComparison(userId: string, id: string): Promise<void> {
  const { error } = await db()
    .from("saved_comparisons")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function listThreads(userId: string): Promise<ThreadRow[]> {
  const { data, error } = await db()
    .from("chat_threads")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as ThreadRow[];
}

export async function createThread(userId: string, firstQuestion: string): Promise<ThreadRow> {
  const { data, error } = await db()
    .from("chat_threads")
    .insert({ user_id: userId, title: threadTitle(firstQuestion) })
    .select("id, title, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as ThreadRow;
}

export async function getThreadMessages(threadId: string): Promise<ChatMessageRow[]> {
  const { data, error } = await db()
    .from("chat_messages")
    .select("id, role, content, citations, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    role: "user" | "assistant";
    content: string;
    citations: unknown;
    created_at: string;
  }[];
  return rows.map((row) => ({ ...row, citations: parseCitations(row.citations) }));
}

export async function loadThread(
  threadId: string,
): Promise<{ thread: ThreadRow; messages: ChatMessageRow[] }> {
  const { data: thread, error } = await db()
    .from("chat_threads")
    .select("id, title, created_at, updated_at")
    .eq("id", threadId)
    .maybeSingle();
  if (error) throw error;
  if (!thread) throw new Error("这条对话不存在或不属于当前账户。");
  const messages = await getThreadMessages(threadId);
  return { thread: thread as ThreadRow, messages };
}

export async function appendMessage(
  userId: string,
  threadId: string,
  role: "user" | "assistant",
  content: string,
  citations: ChatCitation[] = [],
): Promise<void> {
  const { error } = await db().from("chat_messages").insert({
    user_id: userId,
    thread_id: threadId,
    role,
    content,
    citations,
  });
  if (error) throw error;
}

export async function touchThread(userId: string, threadId: string): Promise<void> {
  const { error } = await db()
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteThread(userId: string, threadId: string): Promise<void> {
  const { error } = await db()
    .from("chat_threads")
    .delete()
    .eq("id", threadId)
    .eq("user_id", userId);
  if (error) throw error;
}