/*  This function handles the response generation and enforces response conformity. It returns an object that will be used as the
    JSON response.

    This method requires 4 parameters:
    isSuccessful (Boolean, to determine if its a success or error response) - statusCode (Int, the statusCode of the response)
    message (String, the message to be used in the response) - misc (Object, every remaining field for the response)
*/
const generateRes = (isSuccessful, statusCode, message, misc) => {
    let successStatus;
    if (isSuccessful == true) {//This needs to be a true or false, so its requires to do type checking
        successStatus = "success";
    } else if (isSuccessful == false) {
        successStatus = "error";
    } else {
        return generateServerError;
    }

    if (statusCode > 599 || statusCode < 100) {
        generateServerError;
    }

    let response = {};
    response[successStatus] = {
        "status": statusCode,
        "message": message,
    }


    response[successStatus] = mergeObjects(response[successStatus], misc);

    return response;
}

const generateServerError = () => {
    const error = {
        "error": {
            "status": 500,
            "message": "RES_GENERATION_ERROR",
        }
    }

    return error;
}

//This function merges to objects together and is used in the generateRes method
function mergeObjects(target, source) { 
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (source[key] instanceof Object && !Array.isArray(source[key])) {
                // If the property is an object and not an array, recurse
                target[key] = mergeObjects(target[key] || {}, source[key]);
            } else {
                // Otherwise, copy the property
                target[key] = source[key];
            }
        }
    }
    return target;
}

module.exports = generateRes
