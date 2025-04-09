export async function onRequestGet({ env }) {
  try {
    const listResponse = await env.GUESTBOOK.list();

    // Fetch all entries in parallel
    const entries = await Promise.all(
      listResponse.keys.map(async ({ name }) => {
        const entry = await env.GUESTBOOK.get(name);
        return entry ? JSON.parse(entry) : null;
      })
    );

    // Filter out any null entries
    return Response.json(entries.filter(Boolean));
  } catch (error) {
    return Response.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const entry = await request.json();
    const date = new Date();

    // Basic validation
    if (!entry.name) {
      return new Response('Missing required fields', { status: 400 });
    }

    if (entry.name.length > 50 || entry.remarks.length > 200) {
      return new Response('Content too long', { status: 400 });
    }

    // Generate a unique key for the entry
    const key = `entry-${date.getTime()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get request ip
    const ip = request.headers.get('CF-Connecting-IP') || null;

    // Store the entry in KV
    const newEntry = {
      name: entry.name,
      remarks: entry.remarks,
      timestamp: date.toISOString(),
      ip,
    };
    await env.GUESTBOOK.put(key, JSON.stringify(newEntry));

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response('Internal Server Error', { status: 500 });
  }
}
