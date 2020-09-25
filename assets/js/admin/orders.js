/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @package FacebookCommerce
 */

jQuery( document ).ready( ( $ ) => {

	'use strict';

	const isCommerceOrder = Boolean( wc_facebook_commerce_orders.is_commerce_order );

	const commerceOrderOperations = {
		/**
		 * Restrict order status options to only allowed options.
		 *
		 * @param {Object} $orderStatus Order select jQuery DOM object
		 */
		restrict_order_statuses: $orderStatus => {

			$orderStatus.find( 'option' ).each( function ( index, option ) {

				// check if option value in the allowed list or not
				if ( wc_facebook_commerce_orders.allowed_commerce_statuses.indexOf( option.value ) === -1 ) {
					// delete/remove option if not allowed
					option.remove();
				}
			} );
		},


		/**
		 * Enable or Disable order created fields.
		 *
		 * @param {Boolean} enable whether to enable date fields (true) or not (false)
		 */
		toggle_created_date_fields_status: enable => {
			$( '#order_data' ).find( 'input[name*=order_date]' ).prop( 'disabled', !enable ).toggleClass( 'disabled', !enable );
		},


		/**
		 * Disable order status field
		 *
		 * @param {Object} $orderStatus Order select jQuery DOM object
		 */
		disable_order_status_field: ( $orderStatus ) => {
			$orderStatus.prop( 'disabled', true ).addClass( 'disabled' );
		},


		/**
		 * Toggle customer field
		 *
		 * @param {Boolean} hide
		 */
		toggle_order_customer_field: ( hide ) => {
			$( '#order_data' ).find( '.form-field.wc-customer-user' ).toggleClass( 'hidden', hide );
		},


		/**
		 * Toggle customer field
		 *
		 * @param {Boolean} hide
		 */
		toggle_billing_and_shipping_fields: ( hide ) => {
			$( '#order_data' ).find( 'a.edit_address' ).toggleClass( 'hidden', hide );
		},


		/**
		 * Disable and hide related fields based on commerce order pending status
		 *
		 * @param {Object} $orderStatus Order select jQuery DOM object
		 */
		disable_pending_order_related_fields: ( $orderStatus ) => {

			commerceOrderOperations.toggle_created_date_fields_status( false );
			commerceOrderOperations.disable_order_status_field( $orderStatus );
			commerceOrderOperations.toggle_order_customer_field( true );
			commerceOrderOperations.toggle_billing_and_shipping_fields( true );
		},


		/**
		 * Hide the refund UI when refunds can't be performed.
		 */
		maybe_disable_refunds: () => {

			// only completed (fulfilled) orders can be refunded
			if ( 'completed' !== wc_facebook_commerce_orders.order_status ) {

				$( '.wc-order-bulk-actions .refund-items' ).hide();

				$orderStatusField.find( 'option[value="wc-refunded"]' ).remove();
			}
		}


	};

	let $form                       = $( 'form[id="post"]' );
	let $orderStatusField           = $( '#order_status' );
	let originalOrderStatus         = $orderStatusField.val();
	let shipmentTracking            = wc_facebook_commerce_orders.shipment_tracking;
	let existingTrackingNumber      = '';
	let existingCarrierCode         = '';
	let completeModalTrackingNumber = '';
	let completeModalCarrierCode    = '';

	if ( Array.isArray( shipmentTracking ) && shipmentTracking[ 0 ] ) {
		existingTrackingNumber = shipmentTracking[ 0 ].tracking_number;
		existingCarrierCode    = shipmentTracking[ 0 ].carrier_code;
	}

	if ( isCommerceOrder ) {

		commerceOrderOperations.restrict_order_statuses( $orderStatusField );

		if ( 'pending' === wc_facebook_commerce_orders.order_status ) {
			commerceOrderOperations.disable_pending_order_related_fields( $orderStatusField );
		}

		if ( 'cancelled' === wc_facebook_commerce_orders.order_status ) {
			commerceOrderOperations.disable_order_status_field( $orderStatusField );
		}

		commerceOrderOperations.maybe_disable_refunds();
	}


	/**
	 * Determines whether we need to show the Cancel Order modal.
	 *
	 * @since 2.0.1-dev.1
	 *
	 * @returns {boolean}
	 */
	function shouldShowCancelOrderModal() {

		if ( $( '#post' ).data( 'skip-cancel-modal' ) ) {
			return false;
		}

		if ( 'wc-cancelled' === originalOrderStatus ) {
			return false;
		}

		if ( !isCommerceOrder ) {
			return false;
		}

		return 'wc-cancelled' === $orderStatusField.val();
	}


	/**
	 * Shows and listens for events on the Cancel Order modal.
	 *
	 * @since 2.0.1-dev.1
	 *
	 * @param {jQuery.Event} event a submit event instance
	 */
	function showCancelOrderModal( event ) {

		event.preventDefault();

		// close existing modals
		$( '#wc-backbone-modal-dialog .modal-close' ).trigger( 'click' );

		new $.WCBackboneModal.View( {
			target: 'facebook-for-woocommerce-modal',
			string: {
				message: wc_facebook_commerce_orders.cancel_modal_message,
				buttons: wc_facebook_commerce_orders.cancel_modal_buttons
			}
		} );

		// handle confirm action
		$( '.facebook-for-woocommerce-modal #btn-ok' )
		.off( 'click.facebook_for_commerce' )
		.on( 'click.facebook_for_commerce', ( event ) => {

			event.preventDefault();
			event.stopPropagation();

			blockModal();

			$.post( ajaxurl, {
				action     : wc_facebook_commerce_orders.cancel_order_action,
				order_id   : $( '#post_ID' ).val(),
				reason_code: $( '.facebook-for-woocommerce-modal [name="wc_facebook_cancel_reason"]' ).val(),
				security   : wc_facebook_commerce_orders.cancel_order_nonce
			}, ( response ) => {

				if ( !response || !response.success ) {
					showErrorInModal( response && response.data ? response.data : wc_facebook_commerce_orders.i18n.unknown_error );
					return;
				}

				$( '#post' ).data( 'skip-cancel-modal', true ).trigger( 'submit' );
			} ).fail( () => {

				showErrorInModal( wc_facebook_commerce_orders.i18n.unknown_error );
			} );
		} );

		return false;
	}


	/**
	 * Replaces the content of the active Facebook for WooCommerce modal to show the given error.
	 *
	 * @since 2.0.1-dev.1
	 *
	 * @param {string} error
	 */
	function showErrorInModal( error ) {

		unBlockModal();

		$( '.facebook-for-woocommerce-modal .wc-backbone-modal-content article' ).html( '<p>' + error + '</p>' );
		$( '.facebook-for-woocommerce-modal .wc-backbone-modal-content footer' ).remove();
	}


	/**
	 * Displays the refund modal on form submit.
	 *
	 * @param {Event} event
	 */
	function displayRefundModal( event ) {

		event.preventDefault();

		$( '#wc-backbone-modal-dialog .modal-close' ).trigger( 'click' );


		new $.WCBackboneModal.View( {
			target: 'facebook-for-woocommerce-modal',
			string: {
				message: wc_facebook_commerce_orders.refund_modal_message,
				buttons: wc_facebook_commerce_orders.refund_modal_buttons
			}
		} );

		$( document.body )
		.off( 'wc_backbone_modal_response.facebook_for_commerce' )
		.on( 'wc_backbone_modal_response.facebook_for_commerce', function () {
			// copy the value of the modal select to the WC field
			$( '#refund_reason' ).val( $( '#wc_facebook_refund_reason_modal' ).val() );
			// submit the form
			$form.data( 'allow-submit', true ).submit();
		} );
	}


	/**
	 * Displays the order complete modal on order form submit
	 */
	function displayCompleteModal() {

		$( '#wc-backbone-modal-dialog .modal-close' ).trigger( 'click' );

		if ( completeModalCarrierCode || completeModalTrackingNumber ) {
			$( document.body )
			.off( 'wc_backbone_modal_loaded' )
			.on( 'wc_backbone_modal_loaded', function () {

				if ( completeModalCarrierCode ) {
					$( '#wc_facebook_carrier' ).val( completeModalCarrierCode );
				}

				if ( completeModalTrackingNumber ) {
					$( '#wc_facebook_tracking_number' ).val( completeModalTrackingNumber );

				}
			} );
		}

		new $.WCBackboneModal.View( {
			target: 'facebook-for-woocommerce-modal',
			string: {
				message: wc_facebook_commerce_orders.complete_modal_message,
				buttons: wc_facebook_commerce_orders.complete_modal_buttons
			}
		} );

		// handle confirm action
		$( '.facebook-for-woocommerce-modal #btn-ok' )
		.off( 'click.facebook_for_commerce' )
		.on( 'click.facebook_for_commerce', ( event ) => {

			event.preventDefault();
			event.stopPropagation();

			completeModalCarrierCode    = $( '#wc_facebook_carrier' ).val();
			completeModalTrackingNumber = $( '#wc_facebook_tracking_number' ).val();

			makeCompleteAjaxRequest( true, completeModalCarrierCode, completeModalTrackingNumber );
		} );
	}


	/**
	 * Make complete order AJAX Request
	 *
	 * @param {Boolean} withModal
	 * @param {String} trackingNumber
	 * @param {String} carrierCode
	 */
	function makeCompleteAjaxRequest( withModal = false, trackingNumber = null, carrierCode = null ) {

		if ( !trackingNumber.length ) {

			alert( wc_facebook_commerce_orders.i18n.missing_tracking_number_error );

			return false;
		}

		if ( withModal ) {
			blockModal();
		}

		$form.find( 'button[type=submit].save_order' ).prop( 'disabled', true ).append( '<span class="spinner is-active"></span>' );

		$.post( ajaxurl, {
			action         : wc_facebook_commerce_orders.complete_order_action,
			order_id       : $( '#post_ID' ).val(),
			tracking_number: trackingNumber,
			carrier_code   : carrierCode,
			nonce          : wc_facebook_commerce_orders.complete_order_nonce
		}, ( response ) => {

			if ( !response || !response.success ) {

				let error_message = response && response.data ? response.data : wc_facebook_commerce_orders.i18n.unknown_error;

				if ( withModal ) {
					showErrorInModal( error_message );
				} else {
					alert( error_message );
				}

				return;
			}

			if ( withModal ) {
				unBlockModal();
			}

			$form.data( 'allow-submit', true ).trigger( 'submit' );
		} ).fail( () => {

			showErrorInModal( wc_facebook_commerce_orders.i18n.unknown_error );
		} ).always( () => {

			$form.find( 'button[type=submit].save_order' ).prop( 'disabled', false ).find( 'span.spinner' ).remove();
		} );
	}


	$form.on( 'submit', function ( event ) {

		if ( shouldShowCancelOrderModal() ) {
			return showCancelOrderModal( event );
		}

		if ( !isCommerceOrder || $form.data( 'allow-submit' ) ) {
			return;
		}

		let newOrderStatusField = $orderStatusField.val();

		if ( 'wc-refunded' === newOrderStatusField && originalOrderStatus !== newOrderStatusField ) {
			displayRefundModal( event );
		}

		if ( 'wc-completed' === newOrderStatusField ) {

			event.preventDefault();

			if ( existingTrackingNumber || existingCarrierCode ) {
				makeCompleteAjaxRequest( false, existingTrackingNumber, existingCarrierCode );
			} else {
				displayCompleteModal();
			}
		}
	} );

} );
