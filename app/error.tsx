'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="notfound"><h1>Не вдалося завантажити сторінку.</h1><p>Спробуйте ще раз за мить.</p><button className="button" onClick={reset}>Спробувати знову</button></section>}
