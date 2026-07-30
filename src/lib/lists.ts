import { ensureSession, supabase } from "./supabaseClient";
import { MediaType } from "./types";

export interface ListSummary {
  id: number;
  name: string;
  createdAt: string;
  itemCount: number;
}

export interface ListItemEntry {
  id: number;
  mediaId: number;
  mediaType: MediaType;
  title: string;
  createdAt: string;
}

interface ListRow {
  id: number;
  name: string;
  created_at: string;
}

interface ListItemRow {
  id: number;
  list_id: number;
  media_id: number;
  media_type: string;
  title: string;
  created_at: string;
}

export async function getLists(): Promise<ListSummary[]> {
  const userId = await ensureSession();
  const { data: lists, error } = await supabase
    .from("lists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<ListRow[]>();

  if (error || !lists) return [];

  const { data: items } = await supabase
    .from("list_items")
    .select("list_id")
    .eq("user_id", userId)
    .returns<{ list_id: number }[]>();

  const counts = new Map<number, number>();
  for (const item of items ?? []) {
    counts.set(item.list_id, (counts.get(item.list_id) ?? 0) + 1);
  }

  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    createdAt: l.created_at,
    itemCount: counts.get(l.id) ?? 0,
  }));
}

export async function getList(listId: number): Promise<ListSummary | null> {
  const userId = await ensureSession();
  const { data, error } = await supabase
    .from("lists")
    .select("*")
    .eq("id", listId)
    .eq("user_id", userId)
    .maybeSingle<ListRow>();

  if (error || !data) return null;

  const { count } = await supabase
    .from("list_items")
    .select("id", { count: "exact", head: true })
    .eq("list_id", listId)
    .eq("user_id", userId);

  return { id: data.id, name: data.name, createdAt: data.created_at, itemCount: count ?? 0 };
}

export async function createList(name: string): Promise<ListSummary> {
  const userId = await ensureSession();
  const { data, error } = await supabase
    .from("lists")
    .insert({ user_id: userId, name })
    .select()
    .single<ListRow>();

  if (error || !data) throw new Error(error?.message ?? "Couldn't create list");
  return { id: data.id, name: data.name, createdAt: data.created_at, itemCount: 0 };
}

export async function renameList(listId: number, name: string): Promise<void> {
  const userId = await ensureSession();
  const { error } = await supabase
    .from("lists")
    .update({ name })
    .eq("id", listId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function deleteList(listId: number): Promise<void> {
  const userId = await ensureSession();
  const { error } = await supabase.from("lists").delete().eq("id", listId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function getListItems(listId: number): Promise<ListItemEntry[]> {
  const userId = await ensureSession();
  const { data, error } = await supabase
    .from("list_items")
    .select("*")
    .eq("list_id", listId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<ListItemRow[]>();

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    mediaId: row.media_id,
    mediaType: row.media_type as MediaType,
    title: row.title,
    createdAt: row.created_at,
  }));
}

/** Every list this user has, with the set of media keys already in each — for the "Add to list" picker. */
export async function getListsWithMembership(): Promise<
  { list: ListSummary; memberKeys: Set<string> }[]
> {
  const userId = await ensureSession();
  const lists = await getLists();

  const { data } = await supabase
    .from("list_items")
    .select("list_id, media_id, media_type")
    .eq("user_id", userId)
    .returns<{ list_id: number; media_id: number; media_type: string }[]>();

  return lists.map((list) => {
    const memberKeys = new Set(
      (data ?? [])
        .filter((row) => row.list_id === list.id)
        .map((row) => `${row.media_type}-${row.media_id}`),
    );
    return { list, memberKeys };
  });
}

export async function addToList(
  listId: number,
  item: { id: number; mediaType: MediaType; title: string },
): Promise<void> {
  const userId = await ensureSession();
  const { error } = await supabase.from("list_items").insert({
    list_id: listId,
    user_id: userId,
    media_id: item.id,
    media_type: item.mediaType,
    title: item.title,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function removeFromList(
  listId: number,
  mediaId: number,
  mediaType: MediaType,
): Promise<void> {
  const userId = await ensureSession();
  const { error } = await supabase
    .from("list_items")
    .delete()
    .eq("list_id", listId)
    .eq("media_id", mediaId)
    .eq("media_type", mediaType)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
