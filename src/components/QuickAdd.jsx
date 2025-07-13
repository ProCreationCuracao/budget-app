// src/components/QuickAdd.jsx

import React, { useState, useEffect } from 'react';
import {
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  Input,
  FormControl,
  FormLabel,
  VStack,
  HStack,
  Textarea
} from '@chakra-ui/react';
import { AiOutlinePlus } from 'react-icons/ai';
import { supabase } from '../supabaseClient';

export default function QuickAdd({ onTransactionCreated }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [type, setType] = useState('expense');
  const [accounts, setAccounts] = useState([]);
  const [accountFrom, setAccountFrom] = useState('');
  const [accountTo, setAccountTo] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    // fetch accounts list
    supabase
      .from('accounts')
      .select('id,name')
      .then(({ data }) => setAccounts(data || []));
  }, []);

  const resetForm = () => {
    setType('expense');
    setAccountFrom('');
    setAccountTo('');
    setAmount('');
    setCategory('');
    setLabel('');
    setNote('');
  };

  const handleSubmit = async () => {
    const payload = {
      type,
      account_from: accountFrom,
      account_to: type === 'transfer' ? accountTo : null,
      amount: parseFloat(amount),
      category,
      label,
      note
    };

    const { error } = await supabase
      .from('transactions')
      .insert([payload]);

    if (!error) {
      resetForm();
      onClose();
      onTransactionCreated && onTransactionCreated();
    } else {
      console.error('QuickAdd error:', error);
    }
  };

  return (
    <>
      <IconButton
        aria-label="Quick Add"
        icon={<AiOutlinePlus />}
        position="fixed"
        bottom="6"
        right="6"
        colorScheme="yellow"
        size="lg"
        borderRadius="full"
        onClick={onOpen}
        zIndex={1000}
      />

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Quick Add</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Type</FormLabel>
                <Select value={type} onChange={e => setType(e.target.value)}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>From Account</FormLabel>
                <Select
                  value={accountFrom}
                  onChange={e => setAccountFrom(e.target.value)}
                  placeholder="Select account"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </Select>
              </FormControl>

              {type === 'transfer' && (
                <FormControl>
                  <FormLabel>To Account</FormLabel>
                  <Select
                    value={accountTo}
                    onChange={e => setAccountTo(e.target.value)}
                    placeholder="Select destination"
                  >
                    {accounts
                      .filter(acc => acc.id !== accountFrom)
                      .map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                  </Select>
                </FormControl>
              )}

              <FormControl>
                <FormLabel>Amount</FormLabel>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Category</FormLabel>
                <Input
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="e.g. Groceries"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Label</FormLabel>
                <Input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Walmart"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Note</FormLabel>
                <Textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a note (optional)"
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <HStack spacing={2}>
              <Button onClick={onClose}>Cancel</Button>
              <Button
                colorScheme="yellow"
                onClick={handleSubmit}
                isDisabled={!accountFrom || !amount}
              >
                Add
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
