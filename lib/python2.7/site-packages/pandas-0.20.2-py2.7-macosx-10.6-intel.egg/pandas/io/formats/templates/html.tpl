{# Update the template_structure.html document too #}
{%- block before_style -%}{%- endblock before_style -%}
{% block style %}
<style  type="text/css" >
{% block table_styles %}
{% for s in table_styles %}
    #T_{{uuid}} {{s.selector}} {
    {% for p,val in s.props %}
      {{p}}: {{val}};
    {% endfor -%}
    }
{%- endfor -%}
{% endblock table_styles %}
{% block before_cellstyle %}{% endblock before_cellstyle %}
{% block cellstyle %}
{%- for s in cellstyle %}
    #T_{{uuid}}{{s.selector}} {
    {% for p,val in s.props %}
        {{p}}: {{val}};
    {% endfor %}
    }
{%- endfor -%}
{%- endblock cellstyle %}
</style>
{%- endblock style %}
{%- block before_table %}{% endblock before_table %} 
{%- block table %}  
<table id="T_{{uuid}}" {% if table_attributes %}{{ table_attributes }}{% endif %}> 
{%- block caption %} 
{%- if caption -%} 
    <caption>{{caption}}</caption> 
{%- endif -%} 
{%- endblock caption %} 
{%- block thead %} 
<thead> 
    {%- block before_head_rows %}{% endblock %}
    {%- for r in head %} 
    {%- block head_tr scoped %}
    <tr> 
        {%- for c in r %} 
        {%- if c.is_visible != False %} 
        <{{ c.type }} class="{{c.class}}" {{ c.attributes|join(" ") }}>{{c.value}}</{{ c.type }}>
        {%- endif %} 
        {%- endfor %} 
    </tr> 
    {%- endblock head_tr %}
    {%- endfor %} 
    {%- block after_head_rows %}{% endblock %}
</thead> 
{%- endblock thead %} 
{%- block tbody %} 
<tbody> 
    {%- block before_rows %}{%- endblock before_rows %}
    {%- for r in body %} 
    {%- block tr scoped %}
    <tr> 
        {%- for c in r %} 
        {%- if c.is_visible != False %} 
        <{{ c.type }} id="T_{{ uuid }}{{ c.id }}" class="{{ c.class }}" {{ c.attributes|join(" ") }}>{{ c.display_value }}</{{ c.type }}>
        {%- endif %} 
        {%- endfor %} 
    </tr> 
    {%- endblock tr %}
    {%- endfor %} 
    {%- block after_rows %}{%- endblock after_rows %}
</tbody> 
{%- endblock tbody %} 
</table> 
{%- endblock table %} 
{%- block after_table %}{% endblock after_table %} 
