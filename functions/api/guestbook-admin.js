async function fetchEntry(env, key) {
  const raw = await env.GUESTBOOK.get(key);
  return raw ? JSON.parse(raw) : null;
}

async function approveEntry(env, key) {
  const entry = await fetchEntry(env, key);
  if (!entry) return null;
  entry.needsApproval = false;
  await env.GUESTBOOK.put(key, JSON.stringify(entry));
  return entry;
}

async function undeleteEntry(env, key) {
  const entry = await fetchEntry(env, key);
  if (!entry) return null;
  entry.deleted = false;
  await env.GUESTBOOK.put(key, JSON.stringify(entry));
  return entry;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  if (secret !== env.ADMIN_SECRET) {
    return new Response('Unauthorized', { status: 403 });
  }

  try {
    const list = await env.GUESTBOOK.list();
    const entries = await Promise.all(
      list.keys.map(async ({ name }) => {
        const raw = await env.GUESTBOOK.get(name);
        return raw ? { key: name, ...JSON.parse(raw) } : null;
      })
    );
    const results = entries.filter(Boolean);
    return Response.json(results);
  } catch (err) {
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const { key, secret } = await request.json();
    if (!key || !secret) {
      return new Response('Missing parameters', { status: 400 });
    }
    if (secret !== env.ADMIN_SECRET) {
      return new Response('Unauthorized', { status: 403 });
    }
    const raw = await env.GUESTBOOK.get(key);
    if (!raw) {
      return new Response('Entry not found', { status: 404 });
    }
    const entry = JSON.parse(raw);
    entry.deleted = true;
    await env.GUESTBOOK.put(key, JSON.stringify(entry));
    return Response.json({ success: true });
  } catch (err) {
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const { key, secret, approve } = await request.json();
    if (!key || !secret) {
      return new Response('Missing parameters', { status: 400 });
    }
    if (secret !== env.ADMIN_SECRET) {
      return new Response('Unauthorized', { status: 403 });
    }
    const updated = approve
      ? await approveEntry(env, key)
      : await undeleteEntry(env, key);
    if (!updated) {
      return new Response('Entry not found', { status: 404 });
    }
    return Response.json({ success: true });
  } catch (err) {
    return new Response('Internal Server Error', { status: 500 });
  }
}
