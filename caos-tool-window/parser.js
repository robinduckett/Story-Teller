function parseCode(code){
  chunks = chunkCode(code);
  var tree = parseInjectEventsRemove(chunks);
  return tree;
}

function chunkCode(code){
  var lines = code.split('\n');
  var linesNoComments = lines.filter((line) => {
    return line.trim()[0] !== '*';
  });
  var linesReducedWhitespace = linesNoComments.map((line) => {
    return line.replace(/\s+/g, ' ');
  });
  var linesRemovedInitialFinalWhitespace = linesReducedWhitespace.map((line) => {
    return line.trim();
  });

  var linesRemovedBlanks = linesRemovedInitialFinalWhitespace.filter((line) => {
    return line != '';
  });

  var chunksJoined = linesRemovedBlanks.join(' ');
  return chunksJoined.split(' ');
}

function parseInjectEventsRemove(chunks){
  var inject_chunks = parseCommandList(chunks, 'scrp|rscr|EOF');
  //var events_chunks = parseEventsList(inject_chunks.chunks);
  //var remove_chunks = parseCommandList({start: 'rscr'}, events_chunks.chunks, 'EOF');
  return {type: 'caos-file', inject: inject_chunks.commandList, events: {}, remove: {}};
}

function parseEventsList(){

}

function parseScrp(chunks){

}

function parseCommandList(chunks, endings){
  var commandList = [];
  var done = false;
  do{
    if (chunks.length === 0){
      done = true;
    }else if (endings.includes(chunks[0].toLowerCase())){
      done = true;
    }else if ('doif' === chunks[0].toLowerCase()){
      //console.log(chunks);
      var commands_chunks = parseDoifElifElseEndiStatements(chunks);
      commandList.push(commands_chunks.commands);
      chunks = commands_chunks.chunks;
    }else{
      var command_chunks = parseCommand(chunks);
      commandList.push(command_chunks.command);
      chunks = command_chunks.chunks;
    }
  }while(!done);
  return {commandList: {type: 'command-list', commands: commandList}, chunks: chunks};
}

function parseDoifElifElseEndiStatements(chunks){
  var sections = [];
  var done = false;
  do{
    if (chunks.length === 0){
      sections.push({
        type: 'end-of-file',
        variant: 'error',
        name: chunks[0],
        message: `Expected 'endi' but found end of file instead.`
      });
      chunks = chunks.slice(1);
      done = true;
    }
    else if ('doif' === chunks[0].toLowerCase()){
      var conditional_chunks = parseConditional(chunks.slice(1));
      var commands_chunks = parseCommandList(conditional_chunks.chunks, 'elif|else|endi');
      sections.push({
        type: 'flow',
        variant: chunks[0].toLowerCase(),
        name: chunks[0],
        conditional: conditional_chunks.conditional,
        commandList: commands_chunks.commandList
      });
      chunks = commands_chunks.chunks;
    }else if ('elif' === chunks[0].toLowerCase()){
      var conditional_chunks = parseConditional(chunks.slice(1));
      var commands_chunks = parseCommandList(conditional_chunks.chunks, 'elif|else|endi');
      sections.push({
        type: 'flow',
        variant: chunks[0].toLowerCase(),
        name: chunks[0],
        conditional: conditional_chunks.conditional,
        commandList: commands_chunks.commandList
      });
      chunks = commands_chunks.chunks;
    }else if ('else' === chunks[0].toLowerCase()){
      var commands_chunks = parseCommandList(chunks.slice(1), 'endi');
      sections.push({
        type: 'flow',
        variant: chunks[0].toLowerCase(),
        name: chunks[0],
        commandList: commands_chunks.commandList
      });
      chunks = commands_chunks.chunks;
    }else if ('endi' === chunks[0].toLowerCase()){
      sections.push({
        type: 'flow',
        variant: chunks[0].toLowerCase(),
        name: chunks[0]
      });
      chunks = chunks.slice(1);
      done = true;
    }else{
      console.log(chunks);
      assert(false);
    }
  }while(!done);
  return {commands: {type: 'doif-blob', sections: sections}, chunks: chunks};
}

function parseConditional(chunks){
  if (chunks.length === 0){
    return {
      conditional: {
        type: 'end-of-file',
        variant: 'error',
        message: `Expected conditional but found end of file instead.`
      },
      chunks: chunks
    }
  }
  var chain = [];
  var done = false;
  do{
    var boolean_chunks = parseBoolean(chunks);
    chain.push(boolean_chunks.boolean);
    var possibleBoolop_chunks = parsePossibleBoolop(boolean_chunks.chunks);
    chunks = possibleBoolop_chunks.chunks;
    if (possibleBoolop_chunks.possibleBoolop!==null){
      chain.push(possibleBoolop_chunks.possibleBoolop);
    }else{
      done = true;
    }
  }while (!done);

  return {
    conditional: {
      type: 'conditional',
      conditional: chain
    },
    chunks: chunks
  }
}

function parseBoolean(chunks){
  var left_chunks = parseNumberOrString(chunks);
  var operator = left_chunks.chunks[0];
  var right_chunks = parseNumberOrString(left_chunks.chunks.slice(1));
  if (
    ['eq', 'ne', 'gt', 'ge', 'lt', 'le', '=', '<>', '>', '>=', '<', '<=']
    .includes(operator.toLowerCase())
  ){
    return {
      boolean: {
        type: 'boolean',
        left: left_chunks.value,
        operator: {
          type: 'operator',
          variant: operator.toLowerCase()
            .replace('eq', '=')
            .replace('ne', '<>')
            .replace('gt', '>')
            .replace('ge', '>=')
            .replace('lt', '<')
            .replace('le', '<='),
          name: operator},
        right: right_chunks.value
      },
      chunks: right_chunks.chunks
    }
  }else{
    return {
      boolean: {
        type: 'boolean',
        left: left_chunks.value,
        operator: {
          type: 'operator',
          variant: 'error',
          name: operator,
          message: `Expected operator but found '${operator}'.`},
        right: right_chunks.value
      },
      chunks: right_chunks.chunks
    }
  }
}

function parsePossibleBoolop(chunks){
  if (['and', 'or'].includes(chunks[0].toLowerCase())){
    return {
      possibleBoolop: {
        type: 'bool-op',
        variant: chunks[0].toLowerCase(),
        name: chunks[0]
      },
      chunks: chunks.slice(1)
    };
  }
  return {
      possibleBoolop: null, chunks: chunks
  }
}

function parseCommand(chunks){
  if (['inst'].includes(chunks[0].toLowerCase())){
    return {
      command: {
        type: 'command',
        variant: chunks[0].toLowerCase(),
        name: chunks[0]
      },
      chunks: chunks.slice(1)
    };
  }else if (['setv', 'addv'].includes(chunks[0].toLowerCase())){
    return parseSetvAddsEtc(chunks);
  }else{
    return {
      command: {
        type: 'command',
        variant: 'error',
        name: chunks[0],
        message: `Expected command but found '${chunks[0]}'`
      },
      chunks: chunks.slice(1)
    };
  }
}

function parseSetvAddsEtc(chunks){
  var commandName = chunks[0];
  var argument1_chunks = parseVariable(chunks.slice(1));
  var argument1_chunks;
  if (['setv', 'addv'].includes(commandName.toLowerCase())){
    argument2_chunks = parseNumber(argument1_chunks.chunks);
    return {
      command: {
        type: 'command',
        variant: commandName.toLowerCase(),
        name: commandName,
        arguments: [argument1_chunks.variable, argument2_chunks.value]
      },
      chunks: argument2_chunks.chunks
    };
  }else{
    console.log(chunks);
    assert(false);
  }
}

function parseVariable(chunks){
  if (
    chunks[0][0].toLowerCase()==='v'
    && chunks[0][1].toLowerCase()==='a'
    && (chunks[0][2] >= '0' && chunks[0][2] <= '9')
    && (chunks[0][3] >= '0' && chunks[0][3] <= '9')
  ){
    return {
      variable:
      {
        type: 'variable',
        variant: 'va',
        name: chunks[0]
      },
      chunks: chunks.slice(1)
    }
  }else if(['game'].includes(chunks[0].toLowerCase())){
    var string_chunks = parseString(chunks.slice(1));
    return {
      variable:
      {
        type: 'variable',
        variant: chunks[0].toLowerCase(),
        name: chunks[0],
        varname: string_chunks.value
      },
      chunks: string_chunks.chunks
    };
  }else if(['name'].includes(chunks[0].toLowerCase())){
    console.log(chunks);
  }else{
    return {
      variable: {
        type: 'variable',
        variant: 'error',
        name: chunks[0],
      },
      chunks: chunks.slice(1)
    };
  }
  console.log(chunks);
}

function parseNumber(chunks){
  if (!isNaN(chunks[0])){
    return {value: {type: 'number-literal', value: chunks[0]}, chunks: chunks.slice(1)};
  }else if (['rand'].includes(chunks[0].toLowerCase())){
    var leftArgument_chunks = parseNumber(chunks.slice(1));
    var rightArgument_chunks = parseNumber(leftArgument_chunks.chunks);
    return{
      value: {
        type: 'returning-command',
        variant: chunks[0].toLowerCase(),
        name: chunks[0],
        arguments: [leftArgument_chunks.value, rightArgument_chunks.value]
      },
      chunks: rightArgument_chunks.chunks,
    }
  }else{
    var variable_chunks = parseVariable(chunks);
    return {value: variable_chunks.variable, chunks: variable_chunks.chunks};
  }
}

function parseString(chunks){
  if (chunks[0][0]==='"'){
    var stringsChunks = [];
    var index = 0;
    chunks[0] = chunks[0].slice(1);
    while (chunks[index][chunks[index].length-1]!=='"'){
      stringsChunks.push(chunks[index]);
      index++;
    }
    stringsChunks.push(chunks[index].substring(0, chunks[index].length-1));
    return {value: {type:'string-literal', value: stringsChunks.join(' ')}, chunks: chunks.slice(index+1)};
  }else{
    var variable_chunks = parseVariable(chunks);
    return {value: variable_chunks.variable, chunks: variable_chunks.chunks};
  }
}


function parseNumberOrString(chunks){
  var possibleNumber_chunks = parseNumber(chunks);
  if (possibleNumber_chunks.value!==null){
    return {value: possibleNumber_chunks.value, chunks: possibleNumber_chunks.chunks};
  }
  var possibleString_chunks = parseString(chunks);
  if (possibleString_chunks.value!==null){
    return {value: possibleString_chunks.value, chunks: possibleString_chunks.chunks};
  }
  console.log(chunks);
}
