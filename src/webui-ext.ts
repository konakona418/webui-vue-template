export { invoke, callback };

async function invoke(method: string, ...args: any[]) {
    let fn = (window as any)[method];
    if (typeof fn === 'function') {
        return fn(...args);
    } else {
        return Promise.reject(new Error(`${method} is not a function`));
    }
}

async function callback(method: string, cb: (...args: any[]) => any) {
    (window as any)[method] = cb;
}