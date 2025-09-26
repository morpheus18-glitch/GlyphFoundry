import React from 'react'

type Row = { tag_id:string; slug:string; name:string; node_id:string; confidence:number }

export default function TagsTable({rows}:{rows:Row[]}) {
  return (
    <div className="card">
      <h3 style={{marginTop:0}}>Tags</h3>
      <table>
        <thead><tr><th>Slug</th><th>Name</th><th>Node</th><th>Conf.</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.tag_id + r.node_id}>
              <td><code>{r.slug}</code></td>
              <td>{r.name}</td>
              <td><code>{r.node_id.slice(0,8)}</code></td>
              <td>{(r.confidence ?? 0).toFixed(2)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} style={{color:'#777'}}>No tags yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
