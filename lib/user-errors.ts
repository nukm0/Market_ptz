export function readableError(error:unknown,fallback="Не удалось выполнить действие. Попробуйте ещё раз."){
 const message=error instanceof Error?error.message:String(error||"");
 if(/Failed to fetch|NetworkError|Load failed|fetch failed|network/i.test(message))return "Не удалось соединиться с сервером. Проверьте интернет и попробуйте снова.";
 if(/Unauthorized|Forbidden|JSON|Unexpected token|Request failed|Database request|Session check/i.test(message))return fallback;
 return /[А-Яа-яЁё]/.test(message)?message:fallback;
}
