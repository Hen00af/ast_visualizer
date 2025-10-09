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

  // 1️⃣ 最上位 (括弧外) の || または &&
  const logic = findTopLevelOperator(input, ["||", "&&"]);
  if (logic) {
    const left = input.slice(0, logic.index);
    const right = input.slice(logic.index + logic.op.length);
    return {
      type: logic.op === "&&" ? "AND" : "OR",
      children: [parseCommand(left), parseCommand(right)]
    };
  }

  // 2️⃣ パイプ
  const pipe = findTopLevelOperator(input, ["|"]);
  if (pipe) {
    const left = input.slice(0, pipe.index);
    const right = input.slice(pipe.index + 1);
    return {
      type: "PIPE",
      children: [parseCommand(left), parseCommand(right)]
    };
  }

  // 3️⃣ subshell (括弧の中)
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
    if (valid) {
      return { type: "SUBSHELL", children: [parseCommand(input.slice(1, -1))] };
    }
  }

  // 4️⃣ リダイレクト
  const redirMatch = input.match(/(.*?)(<|>|>>|<<)\s*(\S+)/);
  if (redirMatch) {
    return {
      type: "COMMAND",
      value: redirMatch[1].trim(),
      children: [{ type: "REDIR", value: `${redirMatch[2]} ${redirMatch[3]}` }]
    };
  }

  // 5️⃣ 単純コマンド
  return { type: "COMMAND", value: input };
}
