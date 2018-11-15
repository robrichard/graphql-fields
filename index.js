'use strict';
const options = {};
function getSelections(ast) {
    if (ast &&
        ast.selectionSet &&
        ast.selectionSet.selections &&
        ast.selectionSet.selections.length) {
        return ast.selectionSet.selections;
    }

    return [];
}

function isFragment(ast) {
    return ast.kind === 'InlineFragment' || ast.kind === 'FragmentSpread';
}

function getAST(ast, info) {
    if (ast.kind === 'FragmentSpread') {
        const fragmentName = ast.name.value;
        return info.fragments[fragmentName];
    }
    return ast;
}

function getArguments (ast) {
    return ast.arguments.map(argument => {
        return {
            [argument.name.value]: {
                kind: argument.value.kind,
                value: argument.value.value,
            },
        };
    });
}

function flattenAST(ast, info, obj) {
    obj = obj || {};
    return getSelections(ast).reduce((flattened, a) => {
        if (isFragment(a)) {
            flattened = flattenAST(getAST(a, info), info, flattened);
        } else {
            const name = a.name.value;
            if (options.excludedFields.indexOf(name) !== -1) {
              return flattened;
            }
            if (flattened[name] && flattened[name] !== '__arguments') {
                Object.assign(flattened[name], flattenAST(a, info, flattened[name]));
            } else {
                flattened[name] = flattenAST(a, info);
            }
            if (options.processArguments) {
                // check if the current field has arguments
                if (a.arguments && a.arguments.length) {
                    Object.assign(flattened[name], { __arguments: getArguments(a) });
                }
            }
        }

        return flattened;
    }, obj);
}

module.exports = function graphqlFields(info, obj = {}, opts = { processArguments: false }) {
    const fields = info.fieldNodes || info.fieldASTs;
    options.processArguments = opts.processArguments;
    options.excludedFields = opts.excludedFields || [];
    return fields.reduce((o, ast) => {
            return flattenAST(ast, info, o);
    }, obj) || {};
};
