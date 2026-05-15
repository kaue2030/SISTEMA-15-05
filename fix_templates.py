import re

with open('index.html', 'r') as f:
    lines = f.readlines()

output = []
in_template = False
indent = ""

for line in lines:
    # Check for start of template
    match = re.search(r'<(template|div) id="tpl-([^"]+)">', line)
    if match:
        tag = match.group(1)
        name = match.group(2)
        # Ensure it starts with <template
        line = line.replace(f'<div id="tpl-{name}">', f'<template id="tpl-{name}">')
        in_template = True
        # Store indentation to find matching closing tag
        indent = re.match(r'^\s*', line).group(0)
        output.append(line)
        continue

    # If we are inside a template, look for the closing div at the same indentation
    if in_template:
        if line.strip() == "</div>" and line.startswith(indent):
            line = line.replace("</div>", "</template>")
            in_template = False
            output.append(line)
            continue

    output.append(line)

with open('index.html', 'w') as f:
    f.writelines(output)
