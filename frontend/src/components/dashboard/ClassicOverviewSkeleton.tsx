const ClassicOverviewSkeleton = () => (
  <div className='vcenter-classic-overview vcenter-classic-skeleton' aria-label='正在加载全局摘要' aria-busy='true'>
    <div className='vcenter-classic-skeleton__actions'>
      <span />
      <span />
      <span />
    </div>
    <div className='vcenter-classic-metrics'>
      {[0, 1, 2].map(item => <article key={item}><span /><strong /></article>)}
    </div>
    <div className='vcenter-classic-grid'>
      <section className='vcenter-classic-panel'>
        <header />
        <div className='vcenter-classic-skeleton__lines'><span /><span /><span /></div>
      </section>
      <section className='vcenter-classic-panel'>
        <header />
        <div className='vcenter-classic-skeleton__lines'><span /><span /><span /></div>
      </section>
      <section className='vcenter-classic-panel is-wide'>
        <header />
        <div className='vcenter-classic-skeleton__table'><span /><span /><span /></div>
      </section>
    </div>
  </div>
)

export default ClassicOverviewSkeleton
