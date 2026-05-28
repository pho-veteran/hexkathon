from fastapi import HTTPException, Request



def get_current_user_id(request: Request) -> str:
    claims = (
        request.scope.get("aws.event", {})
        .get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )
    user_id = claims.get("sub")
    if user_id:
        return user_id

    dev_user_id = request.headers.get("x-dev-user-id")
    if dev_user_id:
        return dev_user_id

    raise HTTPException(status_code=401, detail="Missing authenticated user")
