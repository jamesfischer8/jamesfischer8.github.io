---
layout: default
---

# Posts

{% for post in site.posts %}
### [{{ post.title }}]({{ post.url }})

[James Fischer]({{ site.url }})

{{ post.excerpt }}
{% endfor %}

