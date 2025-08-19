import { enableAssert } from 'scenerystack/assert';
import { Property } from 'scenerystack/axon';
import { Bounds2, Vector2 } from 'scenerystack/dot';
import { Shape, LineStyles } from 'scenerystack/kite';
import { optionize3, platform } from 'scenerystack/phet-core';
import { Display, Node, NodeOptions, Path, Rectangle, RichText } from 'scenerystack/scenery';
import { Panel } from 'scenerystack/sun';
import { ArrowNode, PhetFont } from 'scenerystack/scenery-phet';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if ( process.env.NODE_ENV === 'development' ) {
  // Enable assertions if we are in development mode
  enableAssert();
}

// Tracks the bounds of the window (can listen with layoutBoundsProperty.link)
export const layoutBoundsProperty = new Property(
  new Bounds2( 0, 0, window.innerWidth, window.innerHeight )
);

// The root node of the scene graph (all Scenery content will be placed in here)
const rootNode = new Node();

// Display will render the scene graph to the DOM
const display = new Display( rootNode, {
  allowSceneOverflow: false,
  backgroundColor: '#333',
  listenToOnlyElement: false,
  assumeFullWindow: true
} );

// We'll add the automatically-created DOM element to the body.
document.body.appendChild( display.domElement );

// Attach event listeners to the DOM.
display.initializeEvents();

// Lazy resizing logic
let resizePending = true;
const resize = () => {
  resizePending = false;

  const layoutBounds = new Bounds2( 0, 0, window.innerWidth, window.innerHeight );
  display.setWidthHeight( layoutBounds.width, layoutBounds.height );
  layoutBoundsProperty.value = layoutBounds;

  if ( platform.mobileSafari ) {
    window.scrollTo( 0, 0 );
  }
};
const resizeListener = () => {
  resizePending = true;
};
window.addEventListener( 'resize', resizeListener );
window.addEventListener( 'orientationchange', resizeListener );
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
window.visualViewport &&
window.visualViewport.addEventListener( 'resize', resizeListener );
resize();

type MermaidNodeSelfOptions = {
  text: string;
  helpText?: string | null;
  shape?: 'square' | 'diamond';
};

export type MermaidNodeOptions = MermaidNodeSelfOptions & NodeOptions;

const MERMAID_DEFAULT_OPTIONS = {
  shape: 'square',
  helpText: null
} as const;

export class MermaidNode extends Node {

  public readonly enteringEdgeNodes: EnteringEdgeNode[] = [];
  public readonly exitingEdgeNodes: ExitingEdgeNode[] = [];

  private readonly enteringEdgesNode: Node;
  private readonly exitingEdgesNode: Node;
  public readonly text: string;

  public constructor( providedOptions?: MermaidNodeOptions ) {
    const options = optionize3<MermaidNodeOptions, MermaidNodeSelfOptions>()(
      {}, MERMAID_DEFAULT_OPTIONS, providedOptions
    );

    const textNode = new RichText( options.text, {
      font: new PhetFont( 16 ),
      lineWrap: 100,
      align: 'center'
    } );

    const diamondX = 80;
    const diamondY = 50;

    const shapeNode = options.shape === 'square' ? Rectangle.bounds( textNode.bounds.dilated( 20 ), {
      fill: '#ccc',
      cornerRadius: 10
    } ) : new Path( new Shape().moveTo(
      textNode.centerX - diamondX, textNode.centerY
    ).lineTo(
      textNode.centerX, textNode.centerY - diamondY
    ).lineTo(
      textNode.centerX + diamondX, textNode.centerY
    ).lineTo(
      textNode.centerX, textNode.centerY + diamondY
    ).close(), {
      fill: '#ccc'
    } );

    const enteringEdgesNode = new Node();
    const exitingEdgesNode = new Node();

    options.children = [ shapeNode, textNode, exitingEdgesNode, enteringEdgesNode ];

    options.tagName = 'div';
    options.focusable = true;
    options.accessibleHeading = options.text;
    options.groupFocusHighlight = true;
    options.accessibleHelpText = options.helpText;

    super( options );

    this.enteringEdgesNode = enteringEdgesNode;
    this.exitingEdgesNode = exitingEdgesNode;
    this.text = options.text;
  }

  public getBottomAttachmentPoint(): Vector2 {
    return this.bounds.centerBottom;
  }

  public getTopAttachmentPoint(): Vector2 {
    return this.bounds.centerTop;
  }

  public getLeftAttachmentPoint(): Vector2 {
    return this.bounds.leftCenter;
  }

  public getRightAttachmentPoint(): Vector2 {
    return this.bounds.rightCenter;
  }

  public registerEnteringEdge( edge: MermaidDirectionalEdgeNode ): void {
    if ( !this.enteringEdgesNode.children.length ) {
      this.enteringEdgesNode.accessibleHeading = 'Edges entering ' + this.text;
      this.enteringEdgesNode.tagName = 'ul';
    }

    const enteringEdgeNode = new EnteringEdgeNode( this, edge );

    this.enteringEdgeNodes.push( enteringEdgeNode );

    this.enteringEdgesNode.addChild( enteringEdgeNode );
  }

  public registerExitingEdge( edge: MermaidDirectionalEdgeNode ): void {
    if ( !this.exitingEdgesNode.children.length ) {
      this.exitingEdgesNode.accessibleHeading = 'Edges exiting ' + this.text;
      this.exitingEdgesNode.tagName = 'ul';
    }

    const exitingEdgeNode = new ExitingEdgeNode( this, edge );

    this.exitingEdgeNodes.push( exitingEdgeNode );

    this.exitingEdgesNode.addChild( exitingEdgeNode );
  }
}

// TODO: shared subclass
class EnteringEdgeNode extends Node {
  public constructor( public readonly node: MermaidNode, public readonly edge: MermaidDirectionalEdgeNode ) {
    super( {
      containerTagName: 'li',
      tagName: 'button',
      accessibleName: `Edge${edge.text ? ` named ${edge.text}` : ''}`,
      accessibleHelpText: `Retrace the edge ${edge.text ? `named ${edge.text} ` : ''}, moving back to ${edge.startNode.text}`,
      focusable: true
    } );

    this.addInputListener( {
      click: () => {
        edge.startNode.focus();
      }
    } );
  }

  public updateHighlight(): void {
    const edgeShape = this.edge.getArrowShape();
    const globalShape = edgeShape.transformed( this.edge.getLocalToGlobalMatrix() );
    const localShape = globalShape.transformed( this.getGlobalToLocalMatrix() );
    this.focusHighlight = new Shape( [ localShape.getStrokedShape( new LineStyles( { lineWidth: 5 } ) ).subpaths[ 0 ] ] );
  }
}

class ExitingEdgeNode extends Node {
  public constructor( public readonly node: MermaidNode, public readonly edge: MermaidDirectionalEdgeNode ) {
    super( {
      containerTagName: 'li',
      tagName: 'button',
      accessibleName: `Edge${edge.text ? ` named ${edge.text}` : ''}`,
      accessibleHelpText: `Follow the edge ${edge.text ? `named ${edge.text} ` : ''}, moving to ${edge.endNode.text}`,
      focusable: true
    } );

    this.addInputListener( {
      click: () => {
        edge.endNode.focus();
      }
    } );
  }

  public updateHighlight(): void {
    // const edgeBounds = this.edge.bounds;
    // const globalBounds = this.edge.parentToGlobalBounds( edgeBounds );
    // const localBounds = this.globalToLocalBounds( globalBounds );
    // this.focusHighlight = Shape.bounds( localBounds.dilated( 10 ) );

    const edgeShape = this.edge.getArrowShape();
    const globalShape = edgeShape.transformed( this.edge.getLocalToGlobalMatrix() );
    const localShape = globalShape.transformed( this.getGlobalToLocalMatrix() );
    this.focusHighlight = new Shape( [ localShape.getStrokedShape( new LineStyles( { lineWidth: 5 } ) ).subpaths[ 0 ] ] );
  }
}

type MermaidDirectionalEdgeNodeSelfOptions = {
  text?: string | null;
};

export type MermaidDirectionalEdgeNodeOptions = MermaidDirectionalEdgeNodeSelfOptions & NodeOptions;

const MERMAID_DIRECTIONAL_EDGE_DEFAULT_OPTIONS = {
  text: null
} as const;

export class MermaidDirectionalEdgeNode extends Node {
  private arrow: ArrowNode;
  private textNode: Node | null = null;

  public readonly text: string | null;

  public constructor(
    public readonly startNode: MermaidNode,
    public readonly endNode: MermaidNode,
    public readonly startConnection: 'top' | 'bottom' | 'left' | 'right',
    public readonly endConnection: 'top' | 'bottom' | 'left' | 'right',
    providedOptions?: MermaidDirectionalEdgeNodeOptions
  ) {
    const options = optionize3<MermaidDirectionalEdgeNodeOptions, MermaidDirectionalEdgeNodeSelfOptions>()(
      {}, MERMAID_DIRECTIONAL_EDGE_DEFAULT_OPTIONS, providedOptions
    );

    super();

    this.text = options.text;

    this.arrow = new ArrowNode( 0, 0, 100, 0, {
      tailWidth: 1
    } );

    this.addChild( this.arrow );

    if ( options.text !== null ) {
      this.textNode = new Panel( new RichText( options.text, {
        font: new PhetFont( 16 ),
        lineWrap: 100,
        align: 'center',
        fill: 'black'
      } ), {
        stroke: null,
        fill: 'rgba( 255, 255, 255, 0.9 )'
      } );

      this.addChild( this.textNode );
    }

    this.startNode.registerExitingEdge( this );
    this.endNode.registerEnteringEdge( this );
  }

  public getArrowShape(): Shape {
    return this.arrow.shape!;
  }

  public static getAttachmentPoint( node: MermaidNode, connection: 'top' | 'bottom' | 'left' | 'right' ): Vector2 {
    switch( connection ) {
      case 'top':
        return node.getTopAttachmentPoint();
      case 'bottom':
        return node.getBottomAttachmentPoint();
      case 'left':
        return node.getLeftAttachmentPoint();
      case 'right':
        return node.getRightAttachmentPoint();
      default:
        throw new Error( `Invalid connection type: ${connection}` );
    }
  }

  public updateArrow() {
    const startPoint = MermaidDirectionalEdgeNode.getAttachmentPoint( this.startNode, this.startConnection );
    const endPoint = MermaidDirectionalEdgeNode.getAttachmentPoint( this.endNode, this.endConnection );

    this.arrow.setTailAndTip( startPoint.x, startPoint.y, endPoint.x, endPoint.y );

    if ( this.textNode ) {
      // Position the text in the middle of the arrow
      this.textNode.centerX = this.arrow.centerX;
      this.textNode.centerY = this.arrow.centerY;
    }
  }
}

const doesItWorkNode = new MermaidNode({
  text: 'Does it work?',
  helpText: 'Determine whether the system is functioning properly.',
  shape: 'diamond'
});

const dontMessWithItNode = new MermaidNode({
  text: "Don't mess with it",
  helpText: 'If it works, leave it alone.'
});

const didYouMessWithItNode = new MermaidNode({
  text: 'Did you mess with it?',
  helpText: 'Check if you were the one who changed anything.',
  shape: 'diamond'
});

const youIdiotNode = new MermaidNode({
  text: 'You idiot!',
  helpText: 'A humorous response to messing with a working system.'
});

const willYouBeBlamedNode = new MermaidNode({
  text: 'Will you be blamed anyway?',
  helpText: 'Will you be held responsible regardless of what happened?',
  shape: 'diamond'
});

const forgetAboutItNode = new MermaidNode({
  text: 'Forget about it!',
  helpText: 'If you won’t be blamed, just let it go.'
});

const doesAnyoneElseKnowNode = new MermaidNode({
  text: 'Does anyone else know?',
  helpText: 'Determine if anyone else is aware of the problem.',
  shape: 'diamond'
});

const hideItNode = new MermaidNode({
  text: 'Hide it',
  helpText: 'A funny suggestion to cover up the issue.'
});

const youreToastNode = new MermaidNode({
  text: "You're toast!",
  helpText: 'If others know and you’re responsible, you\'re in trouble.'
});

const canYouBlameNode = new MermaidNode({
  text: 'Can you blame someone else?',
  helpText: 'Try to redirect blame if possible.',
  shape: 'diamond'
});

const noProblemNode = new MermaidNode({
  text: 'No problem!',
  helpText: 'Success! You’ve dodged the issue.'
});

const nodes = [
  doesItWorkNode,
  dontMessWithItNode,
  didYouMessWithItNode,
  youIdiotNode,
  willYouBeBlamedNode,
  forgetAboutItNode,
  doesAnyoneElseKnowNode,
  hideItNode,
  youreToastNode,
  canYouBlameNode,
  noProblemNode
];

const e1 = new MermaidDirectionalEdgeNode( doesItWorkNode, dontMessWithItNode, 'left', 'top', { text: 'Yes' } );
const e2 = new MermaidDirectionalEdgeNode( doesItWorkNode, didYouMessWithItNode, 'right', 'top', { text: 'No' } );

const e3 = new MermaidDirectionalEdgeNode( didYouMessWithItNode, youIdiotNode, 'left', 'right', { text: 'Yes' } );
const e4 = new MermaidDirectionalEdgeNode( didYouMessWithItNode, willYouBeBlamedNode, 'bottom', 'top', { text: 'No' } );

const e5 = new MermaidDirectionalEdgeNode( youIdiotNode, doesAnyoneElseKnowNode, 'left', 'right' );

const e6 = new MermaidDirectionalEdgeNode( doesAnyoneElseKnowNode, hideItNode, 'left', 'top', { text: 'No' } );
const e7 = new MermaidDirectionalEdgeNode( doesAnyoneElseKnowNode, youreToastNode, 'bottom', 'top', { text: 'Yes' } );

const e8 = new MermaidDirectionalEdgeNode( willYouBeBlamedNode, youreToastNode, 'left', 'right', { text: 'Yes' } );
const e9 = new MermaidDirectionalEdgeNode( willYouBeBlamedNode, forgetAboutItNode, 'bottom', 'top', { text: 'No' } );

const e10 = new MermaidDirectionalEdgeNode( youreToastNode, canYouBlameNode, 'bottom', 'top' );
const e11 = new MermaidDirectionalEdgeNode( canYouBlameNode, youreToastNode, 'left', 'left', { text: 'No' } );
const e12 = new MermaidDirectionalEdgeNode( canYouBlameNode, noProblemNode, 'bottom', 'top', { text: 'Yes' } );

const e13 = new MermaidDirectionalEdgeNode( hideItNode, noProblemNode, 'bottom', 'left' );
const e14 = new MermaidDirectionalEdgeNode( forgetAboutItNode, noProblemNode, 'bottom', 'right' );
const e15 = new MermaidDirectionalEdgeNode( dontMessWithItNode, noProblemNode, 'bottom', 'left' );

const edges = [ e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12, e13, e14, e15 ];

rootNode.children = [
  ...nodes,
  ...edges
];

// Center the text and the rectangle dynamically
// eslint-disable-next-line @typescript-eslint/no-unused-vars
layoutBoundsProperty.link( ( bounds ) => {
  const centerX = bounds.centerX;
  const topY = 100;

  const dx = 200;
  const dy = 120;

  const place = ( node: Node, col: number, row: number ) => {
    node.centerX = centerX + col * dx;
    node.centerY = topY + row * dy;
  };

  place( doesItWorkNode, 0, 0 );

  place( dontMessWithItNode, -1.5, 1 );
  place( didYouMessWithItNode, 1.5, 1 );

  place( youIdiotNode, 0.5, 1.5 );
  place( doesAnyoneElseKnowNode, -0.5, 1.5 );
  place( willYouBeBlamedNode, 1.5, 2.5 );

  place( hideItNode, -1, 3 );
  place( youreToastNode, 0, 3 );
  place( forgetAboutItNode, 1.5, 4 );

  place( canYouBlameNode, 0, 4 );
  place( noProblemNode, 0, 5.5 );

  for ( const edge of edges ) {
    edge.updateArrow();
  }

  for ( const node of nodes ) {
    for ( const edgeNode of [ ...node.enteringEdgeNodes, ...node.exitingEdgeNodes ] ) {
      edgeNode.updateHighlight();
    }
  }
} );

// Frame step logic
// eslint-disable-next-line @typescript-eslint/no-unused-vars
display.updateOnRequestAnimationFrame( ( dt ) => {
  if ( resizePending ) {
    resize();
  }
} );
