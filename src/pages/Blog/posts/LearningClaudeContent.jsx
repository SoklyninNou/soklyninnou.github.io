export default function LearningClaudeContent() {
  return (
    <>
      <p>
        <b style={{ color: 'red' }}>DISCLAIMER:</b> This is a personal diary/journal, not a Claude guide.
        This will be apparent by how I explain things.
      </p>
      <h1 className="post-subtitle">Background</h1>
      <p>
        When I first found out about Claude Code, I was skeptical on its capabilities. Additionally, I felt
        that AI coding tools was a cheat in a bad way. I thought that AI coding tools are an excuse to not
        learn the concepts and incentivize only knowing surface level information. This contradicts what I
        enjoy doing, which is research and the joy of building things. But, a though I have in the back of
        my mind is that these AI tools are getting more powerful with each passing day. I am still debating
        whether to fully embrace this technology or remain cautious. But, I am slowing using claude for more
        purposes such as reviewing notes.
      </p>
      <p>
        With that being said I figured that learning Claude would be a great way to stay up to date with the
        latest AI developments by not using it to complete my code but learning features like hooks and
        skills.
      </p>
      <h1 className="post-subtitle">Reflections</h1>
      <p>
        This section is to highlight things I&apos;ve observed while using Claude and writing this blog that
        might not relate to the usage of Claude.
      </p>
      <p>
        Being relatively late to adopting these agent-based tools, I find that I am still stuck in the
        mindset of traditional programming approaches. That is, I tend to think about manual steps and
        processes rather than leveraging the agent&apos;s capabilities. Additionally, I am still getting used
        the idea of the agent being probabilistic. In traditional programming, we have deterministic
        outcomes: if this then that and follow these precise lines of code. But with AI tools, there could be
        a degree of uncertainty when working with concepts such as skills, which I find to be more like
        suggestions rather than definitive actions. At least, Claude&apos;s hooks are more deterministic in
        the sense that they are more like hard rules that the agent has to follow.
      </p>
      <h1 className="post-subtitle">Claude Skills</h1>
      <p className="post-page-date">April 23, 2026</p>
      <p>
        The first part I want to explore is to understand how Claude skills work, especially in the context
        of custom command creation.
      </p>
      <p>
        Claude skills is a feature that allows you to create custom commands that Claude can execute. This is
        useful for creating custom tools that can be used in the context of a conversation.
      </p>
      <p>
        I found that skills are quite similar to tools in the sense that they both allow you to create
        custom commands. It seems that tools are more focused on the actual execution of the command and can
        interact with the outside environment like the database, while skills are more like guides showing
        the agent should think and approach problems. This likely means that skills could probably call
        tools to execute specific tasks. I think skills is a great starting point for learning how to
        customize Claude&apos;s behavior as it is quite easy to start implementing.
      </p>
      <p>After some cursory research, I would picture that the workflow is as follows:</p>
      <ol>
        <li>Write a rough draft of SKILL.md: frontmatter, a short body, any obvious scripts.</li>
        <li>Come up with 2-3 realistic test prompts, the kind of thing a real user would actually type</li>
        <li>Run Claude against each prompt twice: once with the skill available, once without. Compare the outputs.</li>
        <li>Read the transcripts, not just the final outputs. Look for places where the skill goes wrong</li>
        <li>Revise, keeping the prompt lean by cutting any unnecessary elements.</li>
        <li>Repeat until the outputs are reliably good.</li>
      </ol>
      <p>
        This is a manual process of creating Skills. But, most people are likely to use Claude itself to
        create and manage these skills. I realized that I have worked on a similar concepts to skills in the
        past, which are agent prompts. When I was customizing my offline agent, I could add extra context to
        the user&apos;s prompt that would guide the agent to think in a certain way in runtime. This is quick
        slow in retrospect, but it is a similar concept to skills in the sense that it is a way to guide the
        agent&apos;s thinking process. One thing I did was feed my agent my entire CS188 notes during running
        and ask it to use those notes to answer questions in a certain format and interpret the notes file a
        certain way, since my notes was written in Typst.
      </p>
      <h1 className="post-subtitle">Claude Hooks</h1>
      <p className="post-page-date">April 24, 2026</p>
      <p>
        The next feature I want to explore is hooks. Hooks are a way to create custom rules that the agent
        has to follow. It does this by running a shell command at a specific lifecycle moment. Hooks are very
        useful when handling jobs where we need absolute certainty such as &quot;never touch this
        .env&quot;. This means we can use hooks to ping external services or perform other actions when
        certain conditions are met. I think hooks are a powerful feature and I can see myself using it a lot
        in the future. To learn about hooks, we must take a slight detour to understand Claude&apos;s
        lifecycle since hooks are triggered at specific moments in the lifecycle.
      </p>
      <h1 className="post-subtitle">Claude Code</h1>
      <p className="post-page-date">April 25, 2026</p>
      <p>
        Now I vaguely understand the theorical aspect of Claude, I want to get some hands on experience with
        the tool, specifically with Claude Code. Claude Code is likely what most people will be familiar
        with. The first app I tried to build was a simple gym tracker. I installed the building-native-ui
        skill and prompted Claude with details on UI elements and how I want the app to look like as well as
        the method of implementing funtionality, specifically using sqlite for the database and expo for
        making universal native apps on the web with JavaScript and React. I guess this is where computer
        science fundamentals could still be relevant. This does not mean that not knowing how to use a
        database or build a web app would make it impossible to build an app with Claude, but it would
        likely make the process more difficult and less efficient. I find that trying to &quot;One
        Shot&quot;, which is giving Claude one prompt with all the details and expecting it to build the
        entire app does not work well. I find that it is better to break down the process into smaller steps
        and iteratively build the app, fixing issues as I go. It does feel quite bad that I don&apos;t have
        full control over the code and don&apos;t know exactly what is going on under the hood, but I guess
        that is the trade off for using a tool that could execution potentially days of work in a few
        minutes.
      </p>
    </>
  );
}
