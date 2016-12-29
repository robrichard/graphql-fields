'use strict';

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


function flattenAST(ast, info, obj) {
    obj = obj || {};
    return getSelections(ast).reduce((flattened, a) => {
        if (isFragment(a)) {
            flattened = flattenAST(getAST(a, info), info, flattened);
        } else {
            const name = a.name.value;
            if (flattened[name]) {
                Object.assign(flattened[name], flattenAST(a, info, flattened[name]));
            } else {
                flattened[name] = flattenAST(a, info);
            }
        }


        return flattened;
    }, obj);
}

module.exports = function graphqlFields(info, obj) {
    obj = obj || {};
    const fields = info.fieldNodes || info.fieldASTs;
    return fields.reduce((o, ast) => {
            return flattenAST(ast, info, o);
    }, obj) || {};
};
