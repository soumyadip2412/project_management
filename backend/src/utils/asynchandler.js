const asynchandler = (requesthandler) =>{
    return (req,res,next)=>{
        Promise
        .resolve(requesthandler(req,res,next))
        .catch((err=> {
            return next(err)
        }))
    }
}

export { asynchandler }