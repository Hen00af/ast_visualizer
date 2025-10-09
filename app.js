function findTopLevelOperator(input, ops) {
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '(') depth++;
    else if (input[i] === ')') depth--;
    else if (depth === 0) {
      for (const op of ops) {
        if (input.startsWith(op, i)) {
          return { index: i, op };
        }
      }
    }
  }
  return null;
}

function parseCommand(input) {
  input = input.trim();
  if (!input) return { type: "EMPTY" };

  // 1️⃣ remove outer parentheses (e.g. "(a && b)" → "a && b")
  if (input.startsWith("(") && input.endsWith(")")) {
    let depth = 0;
    let valid = true;
    for (let i = 0; i < input.length; i++) {
      if (input[i] === '(') depth++;
      else if (input[i] === ')') depth--;
      if (depth === 0 && i < input.length - 1) {
        valid = false;
        break;
      }
    }
    if (valid) return parseCommand(input.slice(1, -1));
  }

  // 2️⃣ handle top-level && / ||
  const logic = findTopLevelOperator(input, ["&&", "||"]);
  if (logic) {
    const left = input.slice(0, logic.index);
    const right = input.slice(logic.index + logic.op.length);
    return {
      type: logic.op === "&&" ? "AND" : "OR",
      children: [parseCommand(left), parseCommand(right)]
    };
  }

  // 3️⃣ handle top-level pipe
  const pipe = findTopLevelOperator(input, ["|"]);
  if (pipe) {
    const left = input.slice(0, pipe.index);
    const right = input.slice(pipe.index + 1);
    return {
      type: "PIPE",
      children: [parseCommand(left), parseCommand(right)]
    };
  }

  // 4️⃣ handle subshell
  if (input.startsWith("(") && input.endsWith(")")) {
    return {
      type: "SUBSHELL",
      children: [parseCommand(input.slice(1, -1))]
    };
  }

  // 5️⃣ handle redirection
  const redirMatch = input.match(/(.*?)(<|>|>>|<<)\s*(\S+)/);
  if (redirMatch) {
    return {
      type: "COMMAND",
      value: redirMatch[1].trim(),
      children: [{ type: "REDIR", value: `${redirMatch[2]} ${redirMatch[3]}` }]
    };
  }

  // 6️⃣ default simple command
  return { type: "COMMAND", value: input };
}
