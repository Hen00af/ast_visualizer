// Utility: find matching parenthesis range
function extractSubshell(input) {
  let depth = 0;
  let start = -1;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '(') {
      if (depth === 0) start = i;
      depth++;
    } else if (input[i] === ')') {
      depth--;
      if (depth === 0 && start !== -1) {
        return {
          inner: input.slice(start + 1, i),
          before: input.slice(0, start),
          after: input.slice(i + 1)
        };
      }
    }
  }
  return null; // no complete subshell found
}

// Recursive parser
function parseCommand(input) {
  input = input.trim();

  // Handle parentheses (subshell)
  const sub = extractSubshell(input);
  if (sub) {
    // Handle operators outside the subshell first
    const before = sub.before.trim();
    const after = sub.after.trim();

    const node = { type: "SUBSHELL", children: [parseCommand(sub.inner)] };

    if (before) {
      // If something exists before, combine logically (e.g. echo && (cat))
      const combined = `${before} ${after ? ` ${after}` : ""}`.trim();
      if (combined.includes("&&")) {
        const [left, right] = combined.split("&&", 2);
        return { type: "AND", children: [parseCommand(left), node] };
      }
      if (combined.includes("||")) {
        const [left, right] = combined.split("||", 2);
        return { type: "OR", children: [parseCommand(left), node] };
      }
      if (combined.includes("|")) {
        const [left, right] = combined.split("|", 2);
        return { type: "PIPE", children: [parseCommand(left), node] };
      }
    }

    if (after) {
      // e.g. (cat) && echo done
      if (after.startsWith("&&")) {
        return { type: "AND", children: [node, parseCommand(after.slice(2))] };
      }
      if (after.startsWith("||")) {
        return { type: "OR", children: [node, parseCommand(after.slice(2))] };
      }
      if (after.startsWith("|")) {
        return { type: "PIPE", children: [node, parseCommand(after.slice(1))] };
      }
    }

    return node;
  }

  // Handle logical AND/OR
  if (input.includes("&&")) {
    const [left, right] = input.split("&&", 2);
    return { type: "AND", children: [parseCommand(left), parseCommand(right)] };
  }
  if (input.includes("||")) {
    const [left, right] = input.split("||", 2);
    return { type: "OR", children: [parseCommand(left), parseCommand(right)] };
  }

  // Handle pipe
  if (input.includes("|")) {
    const [left, right] = input.split("|", 2);
    return { type: "PIPE", children: [parseCommand(left), parseCommand(right)] };
  }

  // Handle redirection
  const redirMatch = input.match(/(.*?)(<|>|>>|<<)\s*(\S+)/);
  if (redirMatch) {
    return {
      type: "COMMAND",
      value: redirMatch[1].trim(),
      children: [{ type: "REDIR", value: `${redirMatch[2]} ${redirMatch[3]}` }]
    };
  }

  // Default simple command
  return { type: "COMMAND", value: input };
}
