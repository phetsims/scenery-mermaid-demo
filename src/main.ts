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
  backgroundColor: '#eee',
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

const startNode = new MermaidNode( {
  text: 'Start',
  helpText: 'This is the starting point of the design process.'
} );

const identifyNode = new MermaidNode( {
  text: 'Identify purpose of design',
  helpText: 'This node represents the first step in the design process, where you identify the purpose of your design.'
} );

const brainstormNode = new MermaidNode( {
  text: 'Brainstorm options',
  helpText: 'In this step, you brainstorm various options for your design. This is a creative phase where you can think freely about different possibilities.'
} );

const finalizeNode = new MermaidNode( {
  text: 'Finalize an idea',
  helpText: 'After brainstorming, you need to finalize one of the ideas to move forward with the design process.'
} );

const developNode = new MermaidNode( {
  text: 'Develop prototype',
  helpText: 'In this step, you develop a prototype based on the finalized idea. This is where you start to create a tangible version of your design.'
} );

const successfulNode = new MermaidNode( {
  text: 'Successful prototype?',
  helpText: 'Follow the edge labeled "Yes" if the prototype is successful, or "No" if it is not.',
  shape: 'diamond'
} );

const fixedNode = new MermaidNode( {
  text: 'Can the problem be fixed?',
  helpText: 'Follow the edge labeled "Yes" if the problem can be fixed, or "No" if it cannot.',
  shape: 'diamond'
} );

const abandonNode = new MermaidNode( {
  text: 'Abandon prototype',
  helpText: 'If the problem cannot be fixed, you may need to abandon the prototype and return to the brainstorming phase.'
} );

const communicateNode = new MermaidNode( {
  text: 'Communicate result',
  helpText: 'In this step, you communicate the results of your prototype development. This is important for sharing your findings and getting feedback.'
} );

const refineNode = new MermaidNode( {
  text: 'Refine design',
  helpText: 'After communicating the results, you may need to refine your design based on feedback and further analysis.'
} );

const endNode = new MermaidNode( {
  text: 'End',
  helpText: 'This is the end of the design process. You have either successfully developed a prototype or abandoned it to return to brainstorming.'
} );

const nodes = [
  startNode,
  identifyNode,
  brainstormNode,
  finalizeNode,
  developNode,
  successfulNode,
  communicateNode,
  refineNode,
  endNode,
  fixedNode,
  abandonNode
];

const startEdge = new MermaidDirectionalEdgeNode( startNode, identifyNode, 'bottom', 'top' );
const identifyEdge = new MermaidDirectionalEdgeNode( identifyNode, brainstormNode, 'bottom', 'top' );
const brainstormEdge = new MermaidDirectionalEdgeNode( brainstormNode, finalizeNode, 'bottom', 'top' );
const finalizeEdge = new MermaidDirectionalEdgeNode( finalizeNode, developNode, 'bottom', 'top' );
const developEdge = new MermaidDirectionalEdgeNode( developNode, successfulNode, 'right', 'left' );
const successfulNoEdge = new MermaidDirectionalEdgeNode( successfulNode, fixedNode, 'right', 'left', {
  text: 'No'
} );
const successfulYesEdge = new MermaidDirectionalEdgeNode( successfulNode, communicateNode, 'bottom', 'top', {
  text: 'Yes'
} );
const communicateEdge = new MermaidDirectionalEdgeNode( communicateNode, refineNode, 'right', 'left' );
const refineEdge = new MermaidDirectionalEdgeNode( refineNode, endNode, 'right', 'left' );
const fixedNoEdge = new MermaidDirectionalEdgeNode( fixedNode, abandonNode, 'right', 'right', {
  text: 'No'
} );
const fixedYesEdge = new MermaidDirectionalEdgeNode( fixedNode, developNode, 'top', 'top', {
  text: 'Yes'
} );
const abandonEdge = new MermaidDirectionalEdgeNode( abandonNode, brainstormNode, 'left', 'right' );

const edges = [
  startEdge,
  identifyEdge,
  brainstormEdge,
  finalizeEdge,
  developEdge,
  successfulNoEdge,
  successfulYesEdge,
  communicateEdge,
  refineEdge,
  fixedNoEdge,
  fixedYesEdge,
  abandonEdge
];

rootNode.children = [
  ...nodes,
  ...edges
];

// Center the text and the rectangle dynamically
// eslint-disable-next-line @typescript-eslint/no-unused-vars
layoutBoundsProperty.link( ( bounds ) => {
  const xPadding = 60;
  const yPadding = 60;

  const leftNodes = [ startNode, identifyNode, brainstormNode, finalizeNode, developNode, communicateNode ];
  const maxLeftWidth = Math.max( ...leftNodes.map( node => node.width ) );

  for ( const leftNode of leftNodes ) {
    leftNode.centerX = 10 + maxLeftWidth / 2;
  }

  startNode.top = 10;
  for ( let i = 1; i < leftNodes.length; i++ ) {
    leftNodes[ i ].top = leftNodes[ i - 1 ].bottom + yPadding;
  }

  successfulNode.left = xPadding + developNode.right;
  successfulNode.centerY = developNode.centerY;

  fixedNode.left = xPadding + successfulNode.right;
  fixedNode.centerY = successfulNode.centerY;

  refineNode.left = xPadding + communicateNode.right;
  refineNode.centerY = communicateNode.centerY;

  endNode.left = xPadding + refineNode.right;
  endNode.centerY = refineNode.centerY;

  abandonNode.left = xPadding + brainstormNode.right;
  abandonNode.centerY = brainstormNode.centerY;

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

  // Rotate the rectangle
  // rotatingRectangle.rotation += 2 * dt;
} );
