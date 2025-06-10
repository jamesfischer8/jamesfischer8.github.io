// Iterate through all guestbook entries until the predicate returns true
async function someEntry(env, predicate) {
  let cursor;
  do {
    const list = await env.GUESTBOOK.list({ prefix: 'entry-', cursor });
    for (const { name } of list.keys) {
      const raw = await env.GUESTBOOK.get(name);
      if (!raw) continue;
      const entry = JSON.parse(raw);
      if (predicate(entry)) {
        return true;
      }
    }
    cursor = list.cursor;
  } while (cursor);
  return false;
}

async function hasPriorPostToday(ip, env, date) {
  const today = date.toISOString().slice(0, 10);
  return someEntry(
    env,
    entry => entry.ip === ip && entry.timestamp?.slice(0, 10) === today
  );
}

async function hasPendingApproval(env) {
  return someEntry(env, entry => entry.needsApproval && !entry.deleted);
}

// Scan entries for at least five posts within the last `hours`
async function hasHighActivity(env, hours, now) {
  const cutoff = now.getTime() - hours * 60 * 60 * 1000;
  let count = 0;
  return someEntry(env, entry => {
    if (entry.deleted) return false;
    if (new Date(entry.timestamp).getTime() >= cutoff) {
      if (++count >= 5) return true;
    }
    return false;
  });
}

export async function onRequestGet({ request, env }) {
  try {
    // Every request should have an IP address
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) {
      return new Response('Missing IP address', { status: 400 });
    }
    const listResponse = await env.GUESTBOOK.list();

    // Fetch all entries in parallel
    const entries = await Promise.all(
      listResponse.keys.map(async ({ name: key }) => {
        const raw = await env.GUESTBOOK.get(key);
        return raw ? JSON.parse(raw) : null;
      })
    );

    // Filter out null entries, soft-deleted or unapproved entries, remove IP
    const publicEntries = entries
      .filter(Boolean)
      .filter(entry => !entry.deleted && !entry.needsApproval)
      .map(entry => {
        const { name, remarks, timestamp, ip: entryIp } = entry;
        const ipMatch = ip === entryIp;
        return { name, remarks, timestamp, ipMatch };
      });
    return Response.json(publicEntries);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

// Allow guests to delete their own entries if IP matches
export async function onRequestDelete({ request, env }) {
  try {
    const { key } = await request.json();
    if (!key) {
      return new Response('Missing entry key', { status: 400 });
    }

    const raw = await env.GUESTBOOK.get(key);
    if (!raw) {
      return new Response('Entry not found', { status: 404 });
    }
    const entry = JSON.parse(raw);


    // Requests must supply the same IP used when posting
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) {
      return new Response('Missing IP address', { status: 400 });
    }
    if (ip !== entry.ip) {
      return new Response('IP mismatch', { status: 403 });
    }

    // Soft delete: mark as deleted instead of removing
    entry.deleted = true;
    await env.GUESTBOOK.put(key, JSON.stringify(entry));
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const entry = await request.json();
    // Treat remarks as optional text
    const remarks = entry.remarks ?? '';
    const date = new Date();

    // Basic validation: name required, remarks optional
    if (!entry.name) {
      return new Response('Missing required fields', { status: 400 });
    }

    if (entry.name.length > 50 || remarks.length > 200) {
      return new Response('Content too long', { status: 400 });
    }

    // Generate a unique key for the entry
    const key = `entry-${date.getTime()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get request IP and fail fast if missing
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) {
      return new Response('Missing IP address', { status: 400 });
    }

    const backlog = await hasPendingApproval(env);
    const highActivity = await hasHighActivity(env, 12, date);
    const priorPost = await hasPriorPostToday(ip, env, date);

    // Store the entry in KV; remarks may be blank
    const newEntry = {
      name: entry.name,
      remarks,
      timestamp: date.toISOString(),
      ip,
      needsApproval: backlog || highActivity || priorPost,
    };
    await env.GUESTBOOK.put(key, JSON.stringify(newEntry));

    // Return only public fields (exclude IP) to the client
    const publicEntry = {
      key,
      name: newEntry.name,
      remarks: newEntry.remarks,
      timestamp: newEntry.timestamp,
      needsApproval: newEntry.needsApproval,
    };
    return new Response(
      JSON.stringify(publicEntry),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response('Internal Server Error', { status: 500 });
  }
}
