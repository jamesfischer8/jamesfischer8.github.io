---
layout: default
---

# Posts
[James Fischer]({{ site.url }})

{% for post in site.posts %}
### [{{ post.title }}]({{ post.url }})
{{ post.excerpt }}
{% endfor %}

